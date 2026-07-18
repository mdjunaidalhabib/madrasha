import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { TransactionClient } from "../../shared/database/transaction";

export class TeacherRepository {
  findMany(madrasaId: number) {
    return prisma.teacher.findMany({
      where: { madrasaId },
      include: { divisionRef: { select: { nameBn: true } } },
      orderBy: { id: "desc" },
    });
  }

  findFirstForTenant(id: number, madrasaId: number) {
    return prisma.teacher.findFirst({
      where: { id, madrasaId },
      include: { divisionRef: { select: { nameBn: true } } },
    });
  }

  create(data: Prisma.TeacherUncheckedCreateInput) {
    return prisma.teacher.create({ data });
  }

  updateManyForTenant(id: number, madrasaId: number, data: Record<string, unknown>) {
    return prisma.teacher.updateMany({ where: { id, madrasaId }, data });
  }

  deleteManyForTenant(id: number, madrasaId: number) {
    return prisma.teacher.deleteMany({ where: { id, madrasaId } });
  }

  /* ---- transaction-scoped helpers used by the bulk-upsert flow ---- */

  findByNidOnTx(tx: TransactionClient, madrasaId: number, nid: string) {
    return tx.teacher.findFirst({ where: { madrasaId, nid } });
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

  runTransaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn);
  }
}

export const teacherRepository = new TeacherRepository();
