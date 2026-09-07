import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { TransactionClient } from "../../shared/database/transaction";

export class StaffRepository {
  findMany(madrasaId: number) {
    return prisma.staff.findMany({
      where: { madrasaId, deletedAt: null },
      orderBy: [{ registrationNo: "asc" }, { id: "asc" }],
    });
  }

  findFirstForTenant(id: number, madrasaId: number) {
    return prisma.staff.findFirst({ where: { id, madrasaId, deletedAt: null } });
  }

  updateManyForTenant(id: number, madrasaId: number, data: Record<string, unknown>) {
    return prisma.staff.updateMany({ where: { id, madrasaId }, data });
  }

  // Soft delete — moves the staff member to Trash instead of hard-deleting.
  deleteManyForTenant(id: number, madrasaId: number) {
    return prisma.staff.updateMany({
      where: { id, madrasaId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  createOnTx(tx: TransactionClient, data: Prisma.StaffUncheckedCreateInput) {
    return tx.staff.create({ data });
  }

  /**
   * Acquires a transaction-scoped, namespaced PostgreSQL advisory lock.
   * Mirrors the teacher repository's lock helper so concurrent staff
   * creations can't race each other onto the same registration number.
   */
  private async lockKeyOnTx(tx: TransactionClient, key: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
  }

  /** Serialises permanent registration-number allocation per madrasa. */
  lockRegistrationScopeOnTx(tx: TransactionClient, madrasaId: number) {
    return this.lockKeyOnTx(tx, `staff-registration:${madrasaId}`);
  }

  /** Highest registration number currently assigned within a madrasa, used
   * to compute the next one for a brand-new staff member. */
  async getMaxRegistrationNoOnTx(tx: TransactionClient, madrasaId: number): Promise<number> {
    const result = await tx.staff.aggregate({
      where: { madrasaId },
      _max: { registrationNo: true },
    });
    return result._max.registrationNo ?? 0;
  }

  runTransaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn);
  }

  /* ================= DASHBOARD SUMMARY ================= */

  countActive(madrasaId: number) {
    return prisma.staff.count({ where: { madrasaId, isActive: 1, deletedAt: null } });
  }

  groupByGender(madrasaId: number) {
    return prisma.staff.groupBy({
      by: ["gender"],
      where: { madrasaId, isActive: 1, deletedAt: null },
      _count: { _all: true },
    });
  }

  groupByDesignation(madrasaId: number) {
    return prisma.staff.groupBy({
      by: ["designation"],
      where: { madrasaId, isActive: 1, deletedAt: null, designation: { not: null } },
      _count: { _all: true },
    });
  }

  /** Monthly joining counts for the last `limit` months with at least one
   * joining, newest first - feeds the শিক্ষক ও স্টাফ dashboard's joining
   * trend chart. Mirrors TeacherRepository.findJoiningTrend. */
  findJoiningTrend(madrasaId: number, limit: number) {
    return prisma.$queryRaw<{ period: string; count: bigint }[]>`
      SELECT to_char(joining_date, 'YYYY-MM') AS period, COUNT(*) AS count
      FROM staff
      WHERE madrasa_id = ${madrasaId} AND deleted_at IS NULL AND joining_date IS NOT NULL
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT ${limit}
    `;
  }
}

export const staffRepository = new StaffRepository();
