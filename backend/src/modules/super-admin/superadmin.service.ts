import { Prisma, WebsiteStatus } from "@prisma/client";
import { hashPassword } from "../../shared/utils/hash.util";
import { BadRequestError, NotFoundError } from "../../shared/errors";
import { TransactionClient } from "../../shared/database/transaction";
import { superAdminRepository, SuperAdminRepository } from "./superadmin.repository";
import {
  DEFAULT_MADRASA_ROLES,
  DEFAULT_STUDENT_LIMIT,
  DEFAULT_USER_LIMIT,
  MADRASA_ACTIVITY,
  WEBSITE_STATUSES,
} from "./superadmin.constants";
import {
  DefaultUserProtectedError,
  InvalidMadrasaIdError,
  InvalidPlanError,
  InvalidRoleError,
  InvalidWebsiteStatusError,
  MadrasaNotFoundError,
  PlanIdRequiredError,
  SlugConflictError,
  TrashedMadrasaOperationError,
  UserEmailConflictError,
  UserEmailRequiredError,
  UserLimitReachedError,
  UserNameRequiredError,
  UserNotFoundError,
  UserPasswordTooShortError,
} from "./superadmin.types";

/** The role that always represents a madrasa's default/owner account (created on madrasa setup). */
const DEFAULT_PROTECTED_ROLE_KEY = "MUHTAMIM";
import { AssignPlanRequestDto, CreateMadrasaRequestDto, UpdateMadrasaRequestDto } from "./superadmin.dto";

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const cleanNumberArray = (v: unknown): number[] => {
  if (!Array.isArray(v)) return [];
  return v.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
};

export class SuperAdminService {
  constructor(private readonly repository: SuperAdminRepository = superAdminRepository) {}

  // NOTE: we intentionally do NOT filter by deleted_at here.
  // A trashed (soft-deleted) madrasa still "owns" its slug — it can be
  // restored later with everything intact, so a new madrasa must not be
  // allowed to steal that slug. Only a PERMANENT delete removes the row
  // entirely, which is what actually frees the slug for reuse.
  private async makeUniqueSlug(base: string) {
    const rows = await this.repository.findMadrasaSlugsStartingWith(base);
    const used = new Set(rows.map((x) => x.slug));

    if (!used.has(base)) return base;

    let i = 2;
    while (used.has(`${base}-${i}`)) i++;
    return `${base}-${i}`;
  }

  async listMadrasas(query: { q?: string; page?: unknown; limit?: unknown }) {
    const q = String(query.q || "");
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Number(query.limit || 10));
    const offset = (page - 1) * limit;

    const where: Prisma.MadrasaWhereInput = {
      deletedAt: null,
      ...(q ? { OR: [{ name: { contains: q } }, { slug: { contains: q } }] } : {}),
    };

    const total = await this.repository.countMadrasas(where);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const madrasas = await this.repository.findMadrasas(where, offset, limit);

    const rows = madrasas.map((m) => {
      const sub = m.subscriptions[0];
      return {
        id: m.id,
        name: m.name,
        slug: m.slug,
        address: m.address,
        phone: m.phone,
        student_limit: m.studentLimit,
        user_limit: m.userLimit,
        is_active: m.isActive,
        website_status: m.websiteStatus,
        plan_id: sub?.planId ?? null,
        plan_name: sub?.plan.name ?? null,
        start_date: sub?.startDate ?? null,
        end_date: sub?.endDate ?? null,
      };
    });

    return { rows, meta: { page, limit, total, totalPages } };
  }

  listPlans() {
    return this.repository.findActivePlans();
  }

  async assignPlanToMadrasa(madrasaId: number, dto: AssignPlanRequestDto) {
    if (!madrasaId) throw new InvalidMadrasaIdError();
    if (!dto.plan_id) throw new PlanIdRequiredError();

    await this.repository.runTransaction(async (tx) => {
      const madrasa = await this.repository.findMadrasaOnTx(tx, madrasaId);
      if (!madrasa) throw new MadrasaNotFoundError();
      if (madrasa.deletedAt) throw new TrashedMadrasaOperationError("Cannot assign plan to trashed madrasa");

      const plan = await this.repository.findActivePlanOnTx(tx, Number(dto.plan_id));
      if (!plan) throw new InvalidPlanError();

      await this.repository.deactivateSubscriptionsOnTx(tx, madrasaId);

      const startDate = new Date(new Date().toDateString());
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + (plan.durationDays || 0));

      await this.repository.createSubscriptionOnTx(tx, madrasaId, plan.id, startDate, endDate);
      await this.repository.updateMadrasaLimitsOnTx(tx, madrasaId, plan.studentLimit, plan.userLimit);
    });
  }

  async createMadrasa(dto: CreateMadrasaRequestDto) {
    if (!dto.name) throw new BadRequestError("Madrasa name required");

    const divisionIds = cleanNumberArray(dto.divisions);
    const moduleIds = cleanNumberArray(dto.modules);
    const classIds = cleanNumberArray(dto.classes);
    const bookIds = cleanNumberArray(dto.books);
    const default_users = dto.default_users || [];

    const baseSlug = slugify(dto.slug || dto.name);
    const finalSlug = await this.makeUniqueSlug(baseSlug);

    const result = await this.repository.runTransaction(async (tx) => {
      const madrasa = await this.repository.createMadrasaOnTx(tx, {
        name: dto.name,
        address: dto.address || null,
        phone: dto.phone || null,
        slug: finalSlug,
        studentLimit: Number(dto.student_limit) || DEFAULT_STUDENT_LIMIT,
        userLimit: Number(dto.user_limit) || DEFAULT_USER_LIMIT,
        isActive: 1,
      });
      const madrasaId = madrasa.id;

      /* ========================= ROLES ========================= */
      const roleMap: Record<string, number> = {};
      for (const r of DEFAULT_MADRASA_ROLES) {
        const role = await this.repository.createRoleOnTx(tx, madrasaId, r.key, r.name);
        roleMap[r.key] = role.id;
      }

      /* ========================= USERS ========================= */
      for (const u of default_users) {
        const roleKey = u.role?.toUpperCase();
        const roleId = roleMap[roleKey];
        if (!roleId) continue;

        const hashed = await hashPassword(u.password);

        await this.repository.createUserOnTx(tx, {
          madrasaId,
          name: u.name || roleKey,
          email: u.email,
          passwordHash: hashed,
          roleId,
          isActive: 1,
        });
      }

      await this.seedAndActivate(tx, madrasaId, divisionIds, moduleIds, classIds, bookIds);

      /* ================= SEEDED PROVISIONING TEMPLATES =================
         prisma seed stores reusable defaults only; it never creates a
         madrasa. Every new madrasa receives a snapshot of the active
         templates, so later seed changes affect future madrasas only. */
      const defaultExams = await this.repository.findDefaultExamsOnTx(tx);
      const defaultGeneralGrades = await this.repository.findDefaultGeneralGradesOnTx(tx);
      const defaultMadrasaGrades = await this.repository.findDefaultMadrasaGradesOnTx(tx);
      const defaultSettings = await this.repository.findDefaultSettingsOnTx(tx);

      const templatesReady =
        defaultExams.length > 0 &&
        defaultGeneralGrades.length > 0 &&
        defaultMadrasaGrades.length > 0 &&
        defaultSettings.some((setting) => setting.name === "fail_mark");
      if (!templatesReady) {
        throw new BadRequestError(
          "New-madrasa templates are missing. Run npx prisma db seed before creating a madrasa.",
        );
      }

      await this.repository.createDefaultExamsOnTx(
        tx,
        madrasaId,
        defaultExams.map((exam) => exam.name),
        String(new Date().getFullYear()),
      );
      await this.repository.createDefaultGeneralGradesOnTx(tx, madrasaId, defaultGeneralGrades);
      await this.repository.createDefaultMadrasaGradesOnTx(tx, madrasaId, defaultMadrasaGrades);
      await this.repository.createDefaultSettingsOnTx(tx, madrasaId, defaultSettings);

      /* ========================= PLAN ========================= */
      if (dto.plan_id) {
        const plan = await this.repository.findActivePlanOnTx(tx, Number(dto.plan_id));
        if (!plan) throw new InvalidPlanError("Invalid plan_id");

        const startDate = new Date(new Date().toDateString());
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + (plan.durationDays || 0));

        await this.repository.createSubscriptionOnTx(tx, madrasaId, plan.id, startDate, endDate);
        await this.repository.updateMadrasaLimitsOnTx(tx, madrasaId, plan.studentLimit, plan.userLimit);
      }

      /* ========================= LOG ========================= */
      await this.repository.createActivityLogOnTx(tx, {
        madrasaId,
        action: MADRASA_ACTIVITY.CREATED,
        entity: "madrasa",
        entityId: madrasaId,
        details: JSON.stringify({ name: dto.name, slug: finalSlug }),
      });

      return { madrasaId, finalSlug };
    });

    return result;
  }

  private async seedAndActivate(
    tx: TransactionClient,
    madrasaId: number,
    divisionIds: number[],
    moduleIds: number[],
    classIds: number[],
    bookIds: number[],
    options: { resetFirst?: boolean } = {},
  ) {
    if (options.resetFirst) {
      // Editing an existing madrasa: clear previous selections first so
      // deselected divisions/modules/classes/books actually turn off.
      await this.repository.deactivateAllMadrasaDivisionsOnTx(tx, madrasaId);
      await this.repository.deactivateAllMadrasaModulesOnTx(tx, madrasaId);
      await this.repository.deactivateAllMadrasaClassesOnTx(tx, madrasaId);
      await this.repository.deactivateAllMadrasaBooksOnTx(tx, madrasaId);
    }

    /* ========================= DIVISIONS ========================= */
    const allDivisions = await this.repository.findAllDivisionIdsOnTx(tx);
    if (allDivisions.length) {
      await this.repository.seedMadrasaDivisionsOnTx(
        tx,
        allDivisions.map((d) => ({ madrasaId, divisionId: d.id, isActive: 0 })),
      );
    }
    await this.repository.activateMadrasaDivisionsOnTx(tx, madrasaId, divisionIds);

    /* ========================= MODULES ========================= */
    const allModules = await this.repository.findAllModuleIdsOnTx(tx);
    if (allModules.length) {
      await this.repository.seedMadrasaModulesOnTx(
        tx,
        allModules.map((m) => ({ madrasaId, moduleId: m.id, isActive: 0 })),
      );
    }
    await this.repository.activateMadrasaModulesOnTx(tx, madrasaId, moduleIds);

    /* ========================= CLASSES ========================= */
    const allClasses = await this.repository.findAllClassIdsOnTx(tx);
    if (allClasses.length) {
      await this.repository.seedMadrasaClassesOnTx(
        tx,
        allClasses.map((c) => ({ madrasaId, classId: c.id, isActive: 0 })),
      );
    }
    await this.repository.activateMadrasaClassesOnTx(tx, madrasaId, classIds);

    /* ========================= BOOKS ========================= */
    const allBooks = await this.repository.findAllBookIdsOnTx(tx);
    if (allBooks.length) {
      await this.repository.seedMadrasaBooksOnTx(
        tx,
        allBooks.map((b) => ({ madrasaId, bookId: b.id, isActive: 0 })),
      );
    }
    await this.repository.activateMadrasaBooksOnTx(tx, madrasaId, bookIds);
  }

  async updateMadrasa(id: number, dto: UpdateMadrasaRequestDto) {
    if (!id) throw new InvalidMadrasaIdError();

    if (
      dto.website_status &&
      !(WEBSITE_STATUSES as readonly string[]).includes(String(dto.website_status))
    ) {
      throw new InvalidWebsiteStatusError();
    }

    // Only touch divisions/modules/classes/books when the client actually
    // sent them (edit form) — undefined means "not part of this update".
    const divisionIds = dto.divisions !== undefined ? cleanNumberArray(dto.divisions) : null;
    const moduleIds = dto.modules !== undefined ? cleanNumberArray(dto.modules) : null;
    const classIds = dto.classes !== undefined ? cleanNumberArray(dto.classes) : null;
    const bookIds = dto.books !== undefined ? cleanNumberArray(dto.books) : null;

    await this.repository.runTransaction(async (tx) => {
      await this.repository.updateMadrasaFieldsOnTx(tx, id, {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.slug ? { slug: dto.slug } : {}),
        address: dto.address || null,
        phone: dto.phone || null,
        ...(Number(dto.student_limit) ? { studentLimit: Number(dto.student_limit) } : {}),
        ...(Number(dto.user_limit) ? { userLimit: Number(dto.user_limit) } : {}),
        ...(dto.is_active === undefined ? {} : { isActive: Number(dto.is_active) }),
        ...(dto.website_status ? { websiteStatus: dto.website_status as WebsiteStatus } : {}),
      });

      if (dto.plan_id) {
        const plan = await this.repository.findActivePlanOnTx(tx, Number(dto.plan_id));
        if (!plan) throw new InvalidPlanError();

        await this.repository.deactivateSubscriptionsOnTx(tx, id);

        const startDate = new Date(new Date().toDateString());
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + (plan.durationDays || 0));

        await this.repository.createSubscriptionOnTx(tx, id, plan.id, startDate, endDate);
        await this.repository.updateMadrasaLimitsOnTx(tx, id, plan.studentLimit, plan.userLimit);
      }

      if (divisionIds !== null || moduleIds !== null || classIds !== null || bookIds !== null) {
        await this.seedAndActivate(
          tx,
          id,
          divisionIds ?? [],
          moduleIds ?? [],
          classIds ?? [],
          bookIds ?? [],
          { resetFirst: true },
        );
      }

      await this.repository.createActivityLogOnTx(tx, {
        madrasaId: id,
        action: MADRASA_ACTIVITY.UPDATED,
        entity: "madrasa",
        entityId: id,
        details: JSON.stringify({
          name: dto.name,
          slug: dto.slug,
          website_status: dto.website_status,
          plan_id: dto.plan_id,
        }),
      });
    });
  }

  async getMadrasaDetail(id: number) {
    if (!id) throw new InvalidMadrasaIdError();

    const madrasa = await this.repository.findMadrasaDetail(id);
    if (!madrasa) throw new MadrasaNotFoundError();

    return {
      id: madrasa.id,
      name: madrasa.name,
      slug: madrasa.slug,
      address: madrasa.address,
      phone: madrasa.phone,
      student_limit: madrasa.studentLimit,
      user_limit: madrasa.userLimit,
      is_active: madrasa.isActive,
      website_status: madrasa.websiteStatus,
      plan_id: madrasa.subscriptions[0]?.planId ?? null,
      divisions: madrasa.madrasaDivisions.map((d) => d.divisionId),
      modules: madrasa.madrasaModules.map((m) => m.moduleId),
    };
  }

  async activateMadrasa(id: number) {
    const result = await this.repository.activateMadrasa(id);

    if (!result.count) {
      const madrasa = await this.repository.findMadrasaDeletedAt(id);
      if (!madrasa) throw new MadrasaNotFoundError();
      if (madrasa.deletedAt) {
        throw new TrashedMadrasaOperationError(
          "This madrasa is in trash. Restore it from the Trash page first.",
        );
      }
    }
  }

  async suspendMadrasa(id: number) {
    const result = await this.repository.suspendMadrasa(id);

    if (!result.count) {
      const madrasa = await this.repository.findMadrasaDeletedAt(id);
      if (!madrasa) throw new MadrasaNotFoundError();
      if (madrasa.deletedAt) {
        throw new TrashedMadrasaOperationError("This madrasa is already in trash.");
      }
    }
  }

  async trashMadrasa(id: number) {
    await this.repository.trashMadrasa(id);
  }

  async listTrash() {
    const rows = await this.repository.findTrash();
    return rows.map((m) => ({
      id: m.id,
      name: m.name,
      slug: m.slug,
      deleted_at: m.deletedAt,
      created_at: m.createdAt,
      is_active: m.isActive,
    }));
  }

  async restoreMadrasa(id: number) {
    const madrasa = await this.repository.findTrashedMadrasaSlug(id);
    if (!madrasa) throw new NotFoundError("Trashed madrasa not found");

    // Safety net: a trashed madrasa's slug is reserved (see makeUniqueSlug),
    // so this should never actually find a conflict — but we keep the check
    // in case a slug was ever changed manually while the madrasa was trashed.
    const conflict = await this.repository.findActiveSlugConflict(madrasa.slug, id);
    if (conflict) throw new SlugConflictError();

    await this.repository.restoreMadrasa(id);
  }

  /* ================= MADRASA USERS (Super Admin setup) ================= */

  async listMadrasaRoles(madrasaId: number) {
    if (!madrasaId) throw new InvalidMadrasaIdError();
    const roles = await this.repository.findMadrasaRoles(madrasaId);
    return roles.map((r) => ({ id: r.id, key: r.keyName, name: r.nameBn }));
  }

  async listMadrasaUsers(madrasaId: number) {
    if (!madrasaId) throw new InvalidMadrasaIdError();
    const users = await this.repository.findMadrasaUsers(madrasaId);
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      is_active: u.isActive,
      role_id: u.roleId,
      role_key: u.role?.keyName ?? null,
      role_name: u.role?.nameBn ?? null,
      created_at: u.createdAt,
    }));
  }

  async createMadrasaUser(
    madrasaId: number,
    dto: { name?: string; email?: string; password?: string; role_id?: number | string },
  ) {
    if (!madrasaId) throw new InvalidMadrasaIdError();

    const madrasa = await this.repository.findMadrasaForUserLimit(madrasaId);
    if (!madrasa) throw new MadrasaNotFoundError();

    const name = (dto.name || "").trim();
    const email = (dto.email || "").trim();
    const password = dto.password || "";
    const roleId = Number(dto.role_id);

    if (!name) throw new UserNameRequiredError();
    if (!email) throw new UserEmailRequiredError();
    if (password.length < 6) throw new UserPasswordTooShortError();
    if (!roleId) throw new InvalidRoleError();

    const role = await this.repository.findMadrasaRoleById(madrasaId, roleId);
    if (!role) throw new InvalidRoleError();

    const activeCount = await this.repository.countActiveUsersForMadrasa(madrasaId);
    if (activeCount >= (madrasa.userLimit ?? 0)) {
      throw new UserLimitReachedError();
    }

    const existing = await this.repository.findMadrasaUserByEmail(madrasaId, email);
    if (existing) throw new UserEmailConflictError();

    const passwordHash = await hashPassword(password);

    const created = await this.repository.createMadrasaUser({
      madrasaId,
      name,
      email,
      passwordHash,
      roleId,
      isActive: 1,
    });

    await this.repository.createActivityLog({
      madrasaId,
      action: "SUPER_ADMIN_USER_CREATED",
      entity: "user",
      entityId: created.id,
      details: JSON.stringify({ name, email, role_id: roleId }),
    });

    return { id: created.id };
  }

  async deleteMadrasaUser(madrasaId: number, userId: number) {
    if (!madrasaId) throw new InvalidMadrasaIdError();
    if (!userId) throw new BadRequestError("Invalid user id");

    const user = await this.repository.findMadrasaUserById(userId, madrasaId);
    if (!user) throw new UserNotFoundError();

    // Every madrasa's default/owner (Muhtamim) account must always exist and
    // can never be removed via this endpoint, no matter what the client sends.
    if (user.role?.keyName === DEFAULT_PROTECTED_ROLE_KEY) {
      throw new DefaultUserProtectedError();
    }

    const result = await this.repository.deleteMadrasaUser(userId, madrasaId);
    if (!result.count) throw new UserNotFoundError();

    await this.repository.createActivityLog({
      madrasaId,
      action: "SUPER_ADMIN_USER_DELETED",
      entity: "user",
      entityId: userId,
      details: JSON.stringify({ user_id: userId }),
    });
  }

  async getMadrasaDeleteStats(id: number) {
    const [students, users, accounts] = await this.repository.countDeleteStats(id);
    return { students, users, accounts };
  }

  async getSuperAdminStats() {
    const [active, inactive, trashed, totalMadrasas, students] = await this.repository.countDashboardStats();

    const recentActivities = await this.repository.findRecentActivities();
    const expiringPlans = await this.repository.findExpiringPlans();
    const expiredPlans = await this.repository.findExpiredPlans();

    return {
      totalMadrasas,
      activeMadrasas: active,
      inactiveMadrasas: inactive,
      trashedMadrasas: trashed,
      totalStudents: students,
      recentActivities: recentActivities || [],
      expiringPlans: expiringPlans || [],
      expiredPlans: expiredPlans || [],
    };
  }

  async permanentDeleteMadrasa(id: number) {
    await this.repository.runTransaction((tx) => this.repository.permanentDeleteCascadeOnTx(tx, id));
  }
}

export const superAdminService = new SuperAdminService();
