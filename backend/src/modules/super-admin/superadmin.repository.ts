import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { TransactionClient } from "../../shared/database/transaction";

export class SuperAdminRepository {
  runTransaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn);
  }

  /* ================= SLUG ================= */

  findMadrasaSlugsStartingWith(base: string) {
    return prisma.madrasa.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } });
  }

  /* ================= LIST / STATS ================= */

  countMadrasas(where: Prisma.MadrasaWhereInput) {
    return prisma.madrasa.count({ where });
  }

  findMadrasas(where: Prisma.MadrasaWhereInput, offset: number, limit: number) {
    return prisma.madrasa.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        address: true,
        phone: true,
        studentLimit: true,
        userLimit: true,
        isActive: true,
        websiteStatus: true,
        subscriptions: {
          where: { isActive: 1 },
          take: 1,
          select: { planId: true, startDate: true, endDate: true, plan: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
    });
  }

  findActivePlans() {
    return prisma.plan.findMany({
      where: { isActive: 1 },
      select: {
        id: true,
        name: true,
        studentLimit: true,
        userLimit: true,
        durationDays: true,
        price: true,
        isActive: true,
      },
      orderBy: { id: "asc" },
    });
  }

  findTrash() {
    return prisma.madrasa.findMany({
      where: { deletedAt: { not: null } },
      select: { id: true, name: true, slug: true, deletedAt: true, createdAt: true, isActive: true },
      orderBy: { deletedAt: "desc" },
    });
  }

  countDeleteStats(id: number) {
    return Promise.all([
      prisma.student.count({ where: { madrasaId: id } }),
      prisma.user.count({ where: { madrasaId: id } }),
      prisma.account.count({ where: { madrasaId: id } }),
    ]);
  }

  countDashboardStats() {
    return Promise.all([
      prisma.madrasa.count({ where: { deletedAt: null, isActive: 1 } }),
      prisma.madrasa.count({ where: { deletedAt: null, isActive: 0 } }),
      prisma.madrasa.count({ where: { deletedAt: { not: null } } }),
      prisma.madrasa.count(),
      prisma.student.count(),
    ]);
  }

  findRecentActivities() {
    return prisma.$queryRaw`
      SELECT
        a.id,
        m.name AS madrasa_name,
        u.name AS user_name,
        a.action,
        a.entity,
        a.entity_id,
        a.details,
        a.created_at
      FROM activity_logs a
      LEFT JOIN madrasas m ON m.id = a.madrasa_id
      LEFT JOIN users u ON u.id = a.user_id
      AND (a.action LIKE 'SUPER_ADMIN%' OR a.action IN ('MADRASA_CREATED','PLAN_CREATED','PLAN_UPDATED','PLAN_DELETED'))
      ORDER BY a.created_at DESC
      LIMIT 15
    `;
  }

  findExpiringPlans() {
    return prisma.$queryRaw`
      SELECT
        m.name AS madrasa_name,
        m.slug,
        p.name AS plan_name,
        s.end_date,
        (s.end_date - CURRENT_DATE) AS days_left
      FROM madrasa_subscriptions s
      JOIN madrasas m ON m.id = s.madrasa_id
      JOIN plans p ON p.id = s.plan_id
      WHERE s.is_active = 1
        AND m.deleted_at IS NULL
        AND s.end_date IS NOT NULL
        AND s.end_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '7 days')
      ORDER BY s.end_date ASC
      LIMIT 30
    `;
  }

  findExpiredPlans() {
    return prisma.$queryRaw`
      SELECT
        m.name AS madrasa_name,
        m.slug,
        p.name AS plan_name,
        s.end_date,
        (CURRENT_DATE - s.end_date) AS days_overdue
      FROM madrasa_subscriptions s
      JOIN madrasas m ON m.id = s.madrasa_id
      JOIN plans p ON p.id = s.plan_id
      WHERE s.is_active = 1
        AND m.deleted_at IS NULL
        AND s.end_date IS NOT NULL
        AND s.end_date < CURRENT_DATE
      ORDER BY s.end_date ASC
      LIMIT 50
    `;
  }

  /* ================= SINGLE MADRASA (non-tx) ================= */

  findMadrasaDeletedAt(id: number) {
    return prisma.madrasa.findUnique({ where: { id }, select: { deletedAt: true } });
  }

  findTrashedMadrasaSlug(id: number) {
    return prisma.madrasa.findFirst({ where: { id, deletedAt: { not: null } }, select: { slug: true } });
  }

  findActiveSlugConflict(slug: string, excludeId: number) {
    return prisma.madrasa.findFirst({
      where: { slug, deletedAt: null, id: { not: excludeId } },
      select: { id: true },
    });
  }

  activateMadrasa(id: number) {
    return prisma.madrasa.updateMany({ where: { id, deletedAt: null }, data: { isActive: 1 } });
  }

  suspendMadrasa(id: number) {
    return prisma.madrasa.updateMany({ where: { id, deletedAt: null }, data: { isActive: 0 } });
  }

  trashMadrasa(id: number) {
    return prisma.madrasa.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date(), isActive: 0 },
    });
  }

  restoreMadrasa(id: number) {
    return prisma.madrasa.update({ where: { id }, data: { deletedAt: null, isActive: 1 } });
  }

  /* ================= TRANSACTION-SCOPED (used by createMadrasa / updateMadrasa / assignPlan / permanentDelete) ================= */

  findMadrasaOnTx(tx: TransactionClient, id: number) {
    return tx.madrasa.findUnique({ where: { id }, select: { id: true, deletedAt: true } });
  }

  findActivePlanOnTx(tx: TransactionClient, planId: number) {
    return tx.plan.findFirst({ where: { id: planId, isActive: 1 } });
  }

  deactivateSubscriptionsOnTx(tx: TransactionClient, madrasaId: number) {
    return tx.madrasaSubscription.updateMany({ where: { madrasaId }, data: { isActive: 0 } });
  }

  createSubscriptionOnTx(
    tx: TransactionClient,
    madrasaId: number,
    planId: number,
    startDate: Date,
    endDate: Date,
  ) {
    return tx.madrasaSubscription.create({ data: { madrasaId, planId, startDate, endDate, isActive: 1 } });
  }

  updateMadrasaLimitsOnTx(tx: TransactionClient, madrasaId: number, studentLimit: number, userLimit: number) {
    return tx.madrasa.update({ where: { id: madrasaId }, data: { studentLimit, userLimit } });
  }

  createMadrasaOnTx(tx: TransactionClient, data: Prisma.MadrasaUncheckedCreateInput) {
    return tx.madrasa.create({ data });
  }

  createRoleOnTx(tx: TransactionClient, madrasaId: number, keyName: string, nameBn: string) {
    return tx.role.create({ data: { madrasaId, keyName, nameBn } });
  }

  createUserOnTx(tx: TransactionClient, data: Prisma.UserUncheckedCreateInput) {
    return tx.user.create({ data });
  }

  findAllDivisionIdsOnTx(tx: TransactionClient) {
    return tx.division.findMany({ select: { id: true } });
  }

  seedMadrasaDivisionsOnTx(tx: TransactionClient, rows: Prisma.MadrasaDivisionCreateManyInput[]) {
    return tx.madrasaDivision.createMany({ data: rows, skipDuplicates: true });
  }

  deactivateAllMadrasaDivisionsOnTx(tx: TransactionClient, madrasaId: number) {
    return tx.madrasaDivision.updateMany({ where: { madrasaId }, data: { isActive: 0 } });
  }

  activateMadrasaDivisionsOnTx(tx: TransactionClient, madrasaId: number, divisionIds: number[]) {
    return tx.madrasaDivision.updateMany({
      where: divisionIds.length ? { madrasaId, divisionId: { in: divisionIds } } : { madrasaId },
      data: { isActive: 1 },
    });
  }

  findAllModuleIdsOnTx(tx: TransactionClient) {
    return tx.moduleDef.findMany({ select: { id: true } });
  }

  seedMadrasaModulesOnTx(tx: TransactionClient, rows: Prisma.MadrasaModuleCreateManyInput[]) {
    return tx.madrasaModule.createMany({ data: rows, skipDuplicates: true });
  }

  deactivateAllMadrasaModulesOnTx(tx: TransactionClient, madrasaId: number) {
    return tx.madrasaModule.updateMany({ where: { madrasaId }, data: { isActive: 0 } });
  }

  activateMadrasaModulesOnTx(tx: TransactionClient, madrasaId: number, moduleIds: number[]) {
    return tx.madrasaModule.updateMany({
      where: moduleIds.length ? { madrasaId, moduleId: { in: moduleIds } } : { madrasaId },
      data: { isActive: 1 },
    });
  }

  findAllClassIdsOnTx(tx: TransactionClient) {
    return tx.class.findMany({ select: { id: true } });
  }

  seedMadrasaClassesOnTx(tx: TransactionClient, rows: Prisma.MadrasaClassCreateManyInput[]) {
    return tx.madrasaClass.createMany({ data: rows, skipDuplicates: true });
  }

  deactivateAllMadrasaClassesOnTx(tx: TransactionClient, madrasaId: number) {
    return tx.madrasaClass.updateMany({ where: { madrasaId }, data: { isActive: 0 } });
  }

  activateMadrasaClassesOnTx(tx: TransactionClient, madrasaId: number, classIds: number[]) {
    return tx.madrasaClass.updateMany({
      where: classIds.length ? { madrasaId, classId: { in: classIds } } : { madrasaId },
      data: { isActive: 1 },
    });
  }

  findAllBookIdsOnTx(tx: TransactionClient) {
    return tx.book.findMany({ select: { id: true } });
  }

  seedMadrasaBooksOnTx(tx: TransactionClient, rows: Prisma.MadrasaBookCreateManyInput[]) {
    return tx.madrasaBook.createMany({ data: rows, skipDuplicates: true });
  }

  deactivateAllMadrasaBooksOnTx(tx: TransactionClient, madrasaId: number) {
    return tx.madrasaBook.updateMany({ where: { madrasaId }, data: { isActive: 0 } });
  }

  activateMadrasaBooksOnTx(tx: TransactionClient, madrasaId: number, bookIds: number[]) {
    return tx.madrasaBook.updateMany({
      where: bookIds.length ? { madrasaId, bookId: { in: bookIds } } : { madrasaId },
      data: { isActive: 1 },
    });
  }

  /* ================= MADRASA DETAIL (for edit prefill) ================= */

  findMadrasaDetail(id: number) {
    return prisma.madrasa.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        address: true,
        phone: true,
        studentLimit: true,
        userLimit: true,
        isActive: true,
        websiteStatus: true,
        subscriptions: {
          where: { isActive: 1 },
          take: 1,
          select: { planId: true },
        },
        madrasaDivisions: {
          where: { isActive: 1 },
          select: { divisionId: true },
        },
        madrasaModules: {
          where: { isActive: 1 },
          select: { moduleId: true },
        },
      },
    });
  }

  createActivityLogOnTx(tx: TransactionClient, data: Prisma.ActivityLogUncheckedCreateInput) {
    return tx.activityLog.create({ data });
  }

  updateMadrasaFieldsOnTx(tx: TransactionClient, id: number, data: Prisma.MadrasaUpdateInput) {
    return tx.madrasa.updateMany({ where: { id, deletedAt: null }, data });
  }

  /* ================= MADRASA USERS (Super Admin setup) ================= */

  findMadrasaRoles(madrasaId: number) {
    return prisma.role.findMany({
      where: { madrasaId },
      select: { id: true, keyName: true, nameBn: true },
      orderBy: { id: "asc" },
    });
  }

  findMadrasaRoleById(madrasaId: number, roleId: number) {
    return prisma.role.findFirst({ where: { id: roleId, madrasaId } });
  }

  findMadrasaUsers(madrasaId: number) {
    return prisma.user.findMany({
      where: { madrasaId },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        roleId: true,
        createdAt: true,
        role: { select: { keyName: true, nameBn: true } },
      },
      orderBy: { id: "desc" },
    });
  }

  findMadrasaForUserLimit(id: number) {
    return prisma.madrasa.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, userLimit: true },
    });
  }

  countActiveUsersForMadrasa(madrasaId: number) {
    return prisma.user.count({ where: { madrasaId, isActive: 1 } });
  }

  findMadrasaUserByEmail(madrasaId: number, email: string) {
    return prisma.user.findFirst({ where: { madrasaId, email } });
  }

  findMadrasaUserById(id: number, madrasaId: number) {
    return prisma.user.findFirst({
      where: { id, madrasaId },
      select: {
        id: true,
        name: true,
        email: true,
        roleId: true,
        role: { select: { keyName: true, nameBn: true } },
      },
    });
  }

  createMadrasaUser(data: Prisma.UserUncheckedCreateInput) {
    return prisma.user.create({ data });
  }

  deleteMadrasaUser(id: number, madrasaId: number) {
    return prisma.user.deleteMany({ where: { id, madrasaId } });
  }

  createActivityLog(data: Prisma.ActivityLogUncheckedCreateInput) {
    return prisma.activityLog.create({ data });
  }

  /* ================= PERMANENT DELETE (tx) ================= */

  permanentDeleteCascadeOnTx(tx: TransactionClient, id: number) {
    return (async () => {
      await tx.rolePermission.deleteMany({ where: { role: { madrasaId: id } } });
      await tx.user.deleteMany({ where: { madrasaId: id } });
      await tx.role.deleteMany({ where: { madrasaId: id } });

      await tx.student.deleteMany({ where: { madrasaId: id } });
      await tx.account.deleteMany({ where: { madrasaId: id } });
      await tx.activityLog.deleteMany({ where: { madrasaId: id } });
      await tx.madrasaSubscription.deleteMany({ where: { madrasaId: id } });
      await tx.madrasaModule.deleteMany({ where: { madrasaId: id } });
      await tx.madrasaDivision.deleteMany({ where: { madrasaId: id } });

      // classes / subjects / results have no madrasa_id column, so only the
      // mapping tables (madrasa_classes / madrasa_books) are deleted here.
      await tx.madrasaClass.deleteMany({ where: { madrasaId: id } });
      await tx.madrasaBook.deleteMany({ where: { madrasaId: id } });

      await tx.payment.deleteMany({ where: { madrasaId: id } });

      await tx.madrasa.delete({ where: { id } });
    })();
  }
}

export const superAdminRepository = new SuperAdminRepository();
