import { prisma } from "../../shared/database/prisma";
import { TransactionClient } from "../../shared/database/transaction";

export class PromotionRepository {
  findStudentsInClass(madrasaId: number, classId: number, academicYear: string) {
    return prisma.student.findMany({
      where: { madrasaId, classId, academicYear, isActive: 1 },
      orderBy: { roll: "asc" },
    });
  }

  /** Latest published result-master for a class (+ specific exam if given),
   * used to look up each student's pass/fail status for the preview. */
  findResultMaster(madrasaId: number, classId: number, examId?: number) {
    return prisma.resultMaster.findFirst({
      where: { madrasaId, classId, ...(examId ? { examId } : {}) },
      orderBy: { id: "desc" },
      include: { summary: true },
    });
  }

  async getMaxRollOnTx(tx: TransactionClient, madrasaId: number, classId: number, academicYear: string) {
    const result = await tx.student.aggregate({
      where: { madrasaId, classId, academicYear },
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

  runTransaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn);
  }
}

export const promotionRepository = new PromotionRepository();
