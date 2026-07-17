import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { TransactionClient } from "../../shared/database/transaction";

export class StudentRepository {
  findMany(where: Prisma.StudentWhereInput) {
    return prisma.student.findMany({
      where,
      select: {
        id: true,
        nameBn: true,
        fatherName: true,
        guardianPhone: true,
        divisionId: true,
        classId: true,
        academicYear: true,
        previousClassId: true,
        gender: true,
        classRef: { select: { nameBn: true } },
      },
      orderBy: { id: "desc" },
    });
  }

  findByIdForTenant(id: number, madrasaId: number) {
    return prisma.student.findFirst({
      where: { id, madrasaId },
      include: { classRef: { select: { nameBn: true } } },
    });
  }

  /**
   * Looks up a student by NID within a tenant, regardless of which
   * academic year they were last admitted under. Used to detect
   * returning students at admission time (re-admission / সেশন পরিবর্তন)
   * so a new session doesn't create a duplicate student record.
   */
  findByNid(madrasaId: number, nid: string) {
    return prisma.student.findFirst({
      where: { madrasaId, nid },
      include: { classRef: { select: { nameBn: true } } },
      orderBy: { id: "desc" },
    });
  }

  create(data: Prisma.StudentUncheckedCreateInput) {
    return prisma.student.create({ data });
  }

  updateManyForTenant(id: number, madrasaId: number, data: Record<string, unknown>) {
    return prisma.student.updateMany({
      where: { id, madrasaId },
      data,
    });
  }

  deleteManyForTenant(id: number, madrasaId: number) {
    return prisma.student.deleteMany({
      where: { id, madrasaId },
    });
  }

  /* ---- transaction-scoped helpers used by the bulk-admission flow ---- */

  findByNidOnTx(tx: TransactionClient, madrasaId: number, nid: string) {
    return tx.student.findFirst({ where: { madrasaId, nid }, orderBy: { id: "desc" } });
  }

  createOnTx(tx: TransactionClient, data: Prisma.StudentUncheckedCreateInput) {
    return tx.student.create({ data });
  }

  updateOnTx(tx: TransactionClient, id: number, data: Record<string, unknown>) {
    return tx.student.update({ where: { id }, data });
  }

  runTransaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn);
  }
}

export const studentRepository = new StudentRepository();
