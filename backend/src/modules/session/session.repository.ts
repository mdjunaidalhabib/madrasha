import { prisma } from "../../shared/database/prisma";
import { TransactionClient } from "../../shared/database/transaction";

export class SessionRepository {
  findSessions(madrasaId: number, activeOnly = false) {
    return prisma.session.findMany({
      where: { madrasaId, ...(activeOnly ? { isActive: true } : {}) },
      orderBy: [{ startDate: "desc" }, { id: "desc" }],
    });
  }

  findSessionForTenant(id: number, madrasaId: number) {
    return prisma.session.findFirst({ where: { id, madrasaId } });
  }

  findByNameForTenant(madrasaId: number, name: string) {
    return prisma.session.findUnique({ where: { madrasaId_name: { madrasaId, name } } });
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

  countReferencingRows(id: number, madrasaId: number) {
    return Promise.all([
      prisma.student.count({ where: { sessionId: id, madrasaId } }),
      prisma.feeStructure.count({ where: { sessionId: id, madrasaId } }),
    ]);
  }

  runTransaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn);
  }

  unsetCurrentOnTx(tx: TransactionClient, madrasaId: number) {
    return tx.session.updateMany({ where: { madrasaId, isCurrent: true }, data: { isCurrent: false } });
  }

  setCurrentOnTx(tx: TransactionClient, id: number) {
    return tx.session.update({ where: { id }, data: { isCurrent: true } });
  }
}

export const sessionRepository = new SessionRepository();
