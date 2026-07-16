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

  updateOnTx(tx: TransactionClient, id: number, data: Record<string, unknown>) {
    return tx.teacher.update({ where: { id }, data });
  }

  runTransaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn);
  }
}

export const teacherRepository = new TeacherRepository();
