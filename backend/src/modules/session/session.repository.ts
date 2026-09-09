import { prisma } from "../../shared/database/prisma";
import { TransactionClient } from "../../shared/database/transaction";

export class SessionRepository {
  findSessions(madrasaId: number, activeOnly = false, divisionId?: number | null) {
    return prisma.session.findMany({
      where: {
        madrasaId,
        ...(activeOnly ? { isActive: true } : {}),
        ...(divisionId !== undefined ? { divisionId } : {}),
      },
      include: { division: { select: { id: true, name: true, nameBn: true } } },
      orderBy: [{ startDate: "desc" }, { id: "desc" }],
    });
  }

  findSessionForTenant(id: number, madrasaId: number) {
    return prisma.session.findFirst({
      where: { id, madrasaId },
      include: { division: { select: { id: true, name: true, nameBn: true } } },
    });
  }

  /** divisionId omitted/undefined -> only the legacy shared (divisionId: null) current session.
   *  divisionId given -> that division's own current session, falling back to the shared
   *  (divisionId: null) current session if the division has none of its own yet. */
  findCurrentSession(madrasaId: number, divisionId?: number | null) {
    if (divisionId != null) {
      return prisma.session.findFirst({ where: { madrasaId, divisionId, isActive: true } }).then((scoped) =>
        scoped ?? prisma.session.findFirst({ where: { madrasaId, divisionId: null, isActive: true } }),
      );
    }
    return prisma.session.findFirst({ where: { madrasaId, divisionId: null, isActive: true } });
  }

  /** divisionId omitted -> search across all divisions for this name (name is no longer
   *  globally unique per madrasa, only per madrasa+division, so prefer passing divisionId
   *  when the caller knows it). */
  findByNameForTenant(madrasaId: number, name: string, divisionId?: number | null) {
    return prisma.session.findFirst({ where: { madrasaId, name, ...(divisionId !== undefined ? { divisionId } : {}) } });
  }

  createSession(madrasaId: number, data: Record<string, unknown>) {
    return prisma.session.create({ data: { ...data, madrasaId } as any });
  }

  updateSession(id: number, madrasaId: number, data: Record<string, unknown>) {
    return prisma.session.updateMany({ where: { id, madrasaId }, data });
  }

  deleteSession(id: number, madrasaId: number) {
    return prisma.session.deleteMany({ where: { id, madrasaId } });
  }

  /** Every Student row referencing sessionId blocks the actual DB delete
   * (onDelete: Restrict on Student.sessionRef), but three kinds of rows are
   * invisible in the normal ছাত্র তালিকা (which only shows
   * admissionStatus=APPROVED, deletedAt=null) and would otherwise leave
   * office staff staring at "N students" with no idea where those students
   * are or how to act:
   *  - trashed (deletedAt set) - only visible in Trash.
   *  - rejected (admissionStatus=REJECTED, not trashed) - a dead-end
   *    admission application with no listing page anywhere in the UI today.
   * The caller reports each bucket with its own specific fix. */
  async countReferencingRows(id: number, madrasaId: number) {
    const [activeStudentCount, rejectedStudentCount, trashedStudentCount, feeStructureCount, invoicedFeeStructureCount] =
      await Promise.all([
        prisma.student.count({
          where: { sessionId: id, madrasaId, deletedAt: null, admissionStatus: { not: "REJECTED" } },
        }),
        prisma.student.count({ where: { sessionId: id, madrasaId, deletedAt: null, admissionStatus: "REJECTED" } }),
        prisma.student.count({ where: { sessionId: id, madrasaId, deletedAt: { not: null } } }),
        prisma.feeStructure.count({ where: { sessionId: id, madrasaId } }),
        // Fee structures with at least one real Invoice - those carry actual
        // billing/collection history and must never be silently deleted.
        prisma.feeStructure.count({ where: { sessionId: id, madrasaId, invoices: { some: {} } } }),
      ]);
    return { activeStudentCount, rejectedStudentCount, trashedStudentCount, feeStructureCount, invoicedFeeStructureCount };
  }

  /** Only ever called after the service confirms invoicedFeeStructureCount
   * is 0, but the `invoices: { none: {} }` guard is kept here too so this
   * method stays safe to call in isolation even if that check is ever
   * skipped or a new invoice sneaks in between the check and this call. */
  deleteUnusedFeeStructuresForSession(id: number, madrasaId: number) {
    return prisma.feeStructure.deleteMany({
      where: { sessionId: id, madrasaId, invoices: { none: {} } },
    });
  }

  runTransaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn);
  }

  unsetCurrentOnTx(tx: TransactionClient, madrasaId: number, divisionId: number | null) {
    return tx.session.updateMany({ where: { madrasaId, divisionId, isActive: true }, data: { isActive: false } });
  }

  setCurrentOnTx(tx: TransactionClient, id: number) {
    return tx.session.update({ where: { id }, data: { isActive: true } });
  }
}

export const sessionRepository = new SessionRepository();
