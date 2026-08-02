import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { TransactionClient } from "../../shared/database/transaction";

export class TeacherRepository {
  findMany(madrasaId: number) {
    return prisma.teacher.findMany({
      where: { madrasaId, deletedAt: null },
      include: { divisionRef: { select: { nameBn: true } } },
      orderBy: [{ registrationNo: "asc" }, { id: "asc" }],
    });
  }

  findFirstForTenant(id: number, madrasaId: number) {
    return prisma.teacher.findFirst({
      where: { id, madrasaId, deletedAt: null },
      include: { divisionRef: { select: { nameBn: true } } },
    });
  }

  create(data: Prisma.TeacherUncheckedCreateInput) {
    return prisma.teacher.create({ data });
  }

  updateManyForTenant(id: number, madrasaId: number, data: Record<string, unknown>) {
    return prisma.teacher.updateMany({ where: { id, madrasaId }, data });
  }

  // Soft delete — moves the teacher to Trash instead of hard-deleting.
  deleteManyForTenant(id: number, madrasaId: number) {
    return prisma.teacher.updateMany({
      where: { id, madrasaId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  /* ---- transaction-scoped helpers used by the bulk-upsert flow ---- */

  findByNidOnTx(tx: TransactionClient, madrasaId: number, nid: string) {
    return tx.teacher.findFirst({ where: { madrasaId, nid, deletedAt: null } });
  }

  /** Batched lookup for bulk-update: one query instead of N. */
  findManyByIdsForTenantOnTx(tx: TransactionClient, ids: number[], madrasaId: number) {
    return tx.teacher.findMany({ where: { id: { in: ids }, madrasaId, deletedAt: null } });
  }

  /** Valid division ids for a tenant (Division is a global catalog, activated
   * per tenant via MadrasaDivision), used to pre-validate an edited
   * division_id before it reaches an update() call - a bad FK value would
   * otherwise poison the rest of the surrounding $transaction on Postgres. */
  async findDivisionIdsForTenantOnTx(tx: TransactionClient, madrasaId: number): Promise<Set<number>> {
    const rows = await tx.madrasaDivision.findMany({ where: { madrasaId }, select: { divisionId: true } });
    return new Set(rows.map((r) => r.divisionId));
  }

  /** Teachers in this tenant whose email matches one of the given values,
   * used to pre-validate bulk-update email edits against the
   * @@unique([madrasaId, email]) constraint before any update() call - a
   * collision would otherwise poison the rest of the $transaction. */
  findTeachersByEmailsForTenantOnTx(tx: TransactionClient, emails: string[], madrasaId: number) {
    if (!emails.length) return Promise.resolve([]);
    return tx.teacher.findMany({
      where: { madrasaId, email: { in: emails }, deletedAt: null },
      select: { id: true, email: true },
    });
  }

  createOnTx(tx: TransactionClient, data: Prisma.TeacherUncheckedCreateInput) {
    return tx.teacher.create({ data });
  }

  /**
   * Acquires a transaction-scoped, namespaced PostgreSQL advisory lock.
   * Mirrors the student repository's lock helper so concurrent teacher
   * creations can't race each other onto the same registration number.
   */
  private async lockKeyOnTx(tx: TransactionClient, key: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
  }

  /** Serialises permanent registration-number allocation per madrasa. */
  lockRegistrationScopeOnTx(tx: TransactionClient, madrasaId: number) {
    return this.lockKeyOnTx(tx, `teacher-registration:${madrasaId}`);
  }

  /** Serialises changes to one teacher record across update flows. */
  lockTeacherRecordOnTx(tx: TransactionClient, madrasaId: number, teacherId: number) {
    return this.lockKeyOnTx(tx, `teacher-record:${madrasaId}:${teacherId}`);
  }

  /** Highest registration number currently assigned within a madrasa, used
   * to compute the next one for a brand-new teacher. */
  async getMaxRegistrationNoOnTx(tx: TransactionClient, madrasaId: number): Promise<number> {
    const result = await tx.teacher.aggregate({
      where: { madrasaId },
      _max: { registrationNo: true },
    });
    return result._max.registrationNo ?? 0;
  }

  updateOnTx(tx: TransactionClient, id: number, data: Record<string, unknown>) {
    return tx.teacher.update({ where: { id }, data });
  }

  updateManyForTenantOnTx(
    tx: TransactionClient,
    id: number,
    madrasaId: number,
    data: Record<string, unknown>,
  ) {
    return tx.teacher.updateMany({ where: { id, madrasaId }, data });
  }

  runTransaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn);
  }
}

export const teacherRepository = new TeacherRepository();
