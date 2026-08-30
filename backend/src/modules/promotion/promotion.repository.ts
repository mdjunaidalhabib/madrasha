import { prisma } from "../../shared/database/prisma";
import { TransactionClient } from "../../shared/database/transaction";

export class PromotionRepository {
  findStudentsInClass(madrasaId: number, classId: number, academicYear: string) {
    return prisma.student.findMany({
      where: { madrasaId, classId, academicYear, isActive: 1, deletedAt: null },
      orderBy: { roll: "asc" },
    });
  }

  /** Latest published result-master for a class (+ specific exam if given),
   * used to look up each student's pass/fail status for the preview. */
  findResultMaster(madrasaId: number, classId: number, examId?: number) {
    return prisma.resultMaster.findFirst({
      where: { madrasaId, classId, deletedAt: null, ...(examId ? { examId } : {}) },
      orderBy: { id: "desc" },
      include: { summary: true },
    });
  }

  async getMaxRollOnTx(tx: TransactionClient, madrasaId: number, classId: number, academicYear: string) {
    const result = await tx.student.aggregate({
      where: { madrasaId, classId, academicYear, deletedAt: null },
      _max: { roll: true },
    });
    return result._max.roll ?? 0;
  }

  createBatchOnTx(
    tx: TransactionClient,
    data: {
      madrasaId: number;
      fromClassId: number;
      toClassId: number;
      fromYear: string;
      toYear: string;
      promotedById: number;
    },
  ) {
    return tx.promotionBatch.create({ data });
  }

  createRecordOnTx(
    tx: TransactionClient,
    data: {
      batchId: number;
      studentId: number;
      oldRoll: number;
      newRoll: number | null;
      status: string;
    },
  ) {
    return tx.promotionRecord.create({ data: data as any });
  }

  promoteStudentOnTx(
    tx: TransactionClient,
    studentId: number,
    data: { classId: number; previousClassId: number; academicYear: string; roll: number },
  ) {
    return tx.student.update({ where: { id: studentId }, data });
  }

  /** Retained students stay in the same class but move to the new
   * academic year, keeping their existing roll (class hasn't changed). */
  retainStudentOnTx(tx: TransactionClient, studentId: number, academicYear: string) {
    return tx.student.update({ where: { id: studentId }, data: { academicYear } });
  }

  /** Every promotion/retention/transfer record for one student across every
   * batch run for this tenant, newest batch first - powers Student 360's
   * academic-history view. PromotionRecord has no madrasaId column of its
   * own, so tenant scoping goes through its parent batch. */
  getHistoryForStudent(studentId: number, madrasaId: number) {
    return prisma.promotionRecord.findMany({
      where: { studentId, batch: { madrasaId } },
      include: {
        batch: {
          select: { fromClassId: true, toClassId: true, fromYear: true, toYear: true, createdAt: true },
        },
      },
      orderBy: { batch: { createdAt: "desc" } },
    });
  }

  runTransaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn);
  }
}

export const promotionRepository = new PromotionRepository();
