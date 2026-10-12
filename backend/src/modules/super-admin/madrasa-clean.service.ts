import { comparePassword } from "../../shared/utils/hash.util";
import { madrasaCleanRepository, MadrasaCleanRepository } from "./madrasa-clean.repository";
import { superAdminRepository, SuperAdminRepository } from "./superadmin.repository";
import { superAdminAccountRepository, SuperAdminAccountRepository } from "./superadmin-account.repository";
import { MADRASA_ACTIVITY } from "./superadmin.constants";
import { MadrasaNotFoundError, TrashedMadrasaOperationError } from "./superadmin.types";
import {
  CleanConfirmNameMismatchError,
  CleanPasswordIncorrectError,
  CleanPasswordRequiredError,
  InvalidCleanModeError,
} from "./madrasa-clean.types";
import { CleanMadrasaDataRequestDto } from "./madrasa-clean.dto";
import { t } from "../../shared/i18n";
import { TransactionClient } from "../../shared/database/transaction";
import { EXAM_FEE_CATEGORY_NAME } from "../fee/fee.constants";
import { BadRequestError } from "../../shared/errors";
import { superAdminService, SuperAdminService } from "./superadmin.service";
import { isMuhtamimRole } from "../../shared/permissions";
import { assignMissingRegistrationBlocksOnTx } from "../students/registration-block.provisioner";
import { parseInstitutionType } from "../../shared/utils/institution.util";

export class MadrasaCleanService {
  constructor(
    private readonly repository: MadrasaCleanRepository = madrasaCleanRepository,
    private readonly superAdminRepo: SuperAdminRepository = superAdminRepository,
    private readonly accountRepo: SuperAdminAccountRepository = superAdminAccountRepository,
    private readonly provisioner: SuperAdminService = superAdminService,
  ) {}

  async getCleanStats(id: number) {
    const [students, invoices, exams, attendanceRecords, users, staff, teachers] =
      await this.repository.countCleanStats(id);
    return { students, invoices, exams, attendanceRecords, users, staff, teachers };
  }

  /** Double-confirmed, password-verified, irreversible tenant data wipe -
   * see madrasa-clean.repository.ts for exactly what each mode removes.
   * actingSuperAdminId is whoever is logged in and calling this (from the
   * JWT, not the tenant being wiped) - their OWN password is re-verified
   * here as the second confirmation factor. */
  async cleanMadrasaData(id: number, actingSuperAdminId: number, dto: CleanMadrasaDataRequestDto) {
    if (dto.mode !== "operational" && dto.mode !== "full") throw new InvalidCleanModeError();

    const madrasa = await this.repository.findMadrasaForClean(id);
    if (!madrasa) throw new MadrasaNotFoundError();
    if (madrasa.deletedAt) {
      throw new TrashedMadrasaOperationError(t({ bn: "ট্র্যাশে থাকা প্রতিষ্ঠানের ডেটা ক্লিন করা যাবে না", en: "A trashed institution's data cannot be cleaned" }));
    }

    if ((dto.confirm_name || "").trim() !== madrasa.name) {
      throw new CleanConfirmNameMismatchError();
    }

    if (!dto.password) throw new CleanPasswordRequiredError();
    const admin = await this.accountRepo.findById(actingSuperAdminId);
    if (!admin) throw new CleanPasswordIncorrectError();
    const validPassword = await comparePassword(dto.password, admin.passwordHash);
    if (!validPassword) throw new CleanPasswordIncorrectError();

    // Wipe + re-seed in ONE transaction: a failure part-way rolls everything
    // back instead of leaving the tenant half-empty.
    await this.repository.runTransaction(async (tx) => {
      if (dto.mode === "full") {
        // Factory reset = "as if just created": read what this institution
        // was set up with BEFORE wiping it, wipe, then rebuild it with the
        // very same provisioning code createMadrasa uses.
        const snapshot = await this.snapshotProvisioningInputOnTx(tx, id);
        await this.repository.wipeFullDataOnTx(tx, id);
        await this.provisioner.provisionTenantOnTx(tx, id, {
          institutionType: parseInstitutionType(madrasa.institutionType) ?? "MADRASA",
          ...snapshot,
        });
        // Plan/subscription survived the wipe; lay the registration-number
        // blocks out again from it, exactly like creation does.
        await assignMissingRegistrationBlocksOnTx(tx, id);
      } else {
        await this.repository.wipeOperationalDataOnTx(tx, id);
        await this.reseedDefaultsOnTx(tx, id, madrasa.institutionType);
      }
    });

    // Written AFTER the wipe (both modes clear ActivityLog) so this is the
    // one record that survives, marking who cleaned this tenant and when.
    await this.superAdminRepo.createActivityLog({
      madrasaId: id,
      action: MADRASA_ACTIVITY.DATA_CLEANED,
      entity: "madrasa",
      entityId: id,
      details: JSON.stringify({ mode: dto.mode, superAdminId: actingSuperAdminId }),
    });
  }
  /** What the institution was provisioned with, read before a factory reset
   * so the rebuild gives back the same divisions/classes/books/modules and a
   * working admin login (the creation form's selections aren't stored
   * anywhere else).
   *
   * Logins: only the Muhtamim (main admin) accounts come back, with their
   * existing password hash - so the institution is usable straight away with
   * the same credentials, like right after creation. Other staff logins and
   * custom roles were tenant data and are not restored. */
  private async snapshotProvisioningInputOnTx(tx: TransactionClient, madrasaId: number) {
    const [divisions, modules, classes, books, users] = await Promise.all([
      tx.madrasaDivision.findMany({ where: { madrasaId, isActive: 1 }, select: { divisionId: true } }),
      tx.madrasaModule.findMany({ where: { madrasaId, isActive: 1 }, select: { moduleId: true } }),
      tx.madrasaClass.findMany({ where: { madrasaId, isActive: 1, deletedAt: null }, select: { classId: true } }),
      tx.madrasaBook.findMany({ where: { madrasaId, isActive: 1, deletedAt: null }, select: { bookId: true } }),
      tx.user.findMany({
        where: { madrasaId },
        select: { name: true, email: true, passwordHash: true, isActive: true, role: { select: { keyName: true } } },
        orderBy: { id: "asc" },
      }),
    ]);
    return {
      divisionIds: divisions.map((d) => d.divisionId),
      moduleIds: modules.map((m) => m.moduleId),
      classIds: classes.map((c) => c.classId),
      bookIds: books.map((b) => b.bookId),
      users: users
        .filter((u) => u.role?.keyName && isMuhtamimRole(u.role.keyName))
        .map((u) => ({ role: u.role!.keyName!, name: u.name, email: u.email, passwordHash: u.passwordHash })),
    };
  }

  /** Operational clean only: classes, books, sessions, grades and settings
   * survived, so just put back what that wipe removed - the default exams,
   * their dormant exam-fee rows and the default fee structures for the
   * active classes (the same templates createMadrasa copies). Demo exam
   * routines are not re-created. Idempotent (skipDuplicates). */
  private async reseedDefaultsOnTx(tx: TransactionClient, madrasaId: number, institutionType: string | null) {
    const repo = this.superAdminRepo;
    const defaultExams = await repo.findDefaultExamsOnTx(tx);
    if (!defaultExams.length) {
      throw new BadRequestError(
        t({
          bn: "ডিফল্ট টেমপ্লেট নেই। ক্লিনের আগে npx prisma db seed চালান।",
          en: "Default templates are missing. Run npx prisma db seed before cleaning.",
        }),
      );
    }
    const currentYear = String(new Date().getFullYear());
    const examNames = defaultExams.map((e) => e.name);
    await repo.createDefaultExamsOnTx(tx, madrasaId, examNames, currentYear);

    const session =
      (await tx.session.findFirst({ where: { madrasaId, isActive: true }, select: { id: true } })) ??
      (await repo.createDefaultSessionOnTx(tx, madrasaId, currentYear, institutionType === "COLLEGE" ? 6 : 0));
    const activeClasses = await tx.madrasaClass.findMany({
      where: { madrasaId, isActive: 1, deletedAt: null },
      select: { classId: true },
    });
    const classIds = activeClasses.map((c) => c.classId);
    const templates = await repo.findDefaultFeeStructuresOnTx(tx);
    const exams = await repo.findExamsByNamesOnTx(tx, madrasaId, examNames);
    const examTemplates = templates.filter((s) => s.feeType === EXAM_FEE_CATEGORY_NAME);
    const examRows = exams.flatMap((exam) =>
      classIds.flatMap((classId) => {
        const tpl = examTemplates.find((x) => x.classId === classId) ?? examTemplates.find((x) => x.classId === null);
        return tpl ? [{ ...tpl, classId, examId: exam.id, isActive: false }] : [];
      }),
    );
    const rows = [
      ...templates.filter(
        (s) => s.feeType !== EXAM_FEE_CATEGORY_NAME && (s.classId === null || classIds.includes(s.classId)),
      ),
      ...examRows,
    ];
    if (rows.length) await repo.createDefaultFeeStructuresOnTx(tx, madrasaId, rows, currentYear, session.id);
  }
}

export const madrasaCleanService = new MadrasaCleanService();
