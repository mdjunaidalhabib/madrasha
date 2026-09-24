import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { EXAM_FEE_CATEGORY_NAME } from "./fee.constants";

/**
 * পরীক্ষার ফি (exam fee) data access - the per-exam, per-class FeeStructure
 * rows (feeType = পরীক্ষার ফি, examId set) that ExamFeeService keeps in step
 * with each exam's বিভাগ scope. Every query is scoped to one madrasa.
 */
export class ExamFeeRepository {
  /** Live exams with their division scope, in the madrasa's exam order. */
  findExams(madrasaId: number, examId?: number) {
    return prisma.exam.findMany({
      where: { madrasaId, deletedAt: null, ...(examId ? { id: examId } : {}) },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        year: true,
        isActive: true,
        divisions: { select: { divisionId: true } },
      },
    });
  }

  /** This madrasa's active classes (in active divisions), in the madrasa's
   * own division/class order - the columns an exam fee can be set for. */
  async findActiveClasses(madrasaId: number) {
    const [divisions, classes] = await Promise.all([
      prisma.madrasaDivision.findMany({
        where: { madrasaId, isActive: 1, deletedAt: null },
        select: { divisionId: true, sortOrder: true, division: { select: { nameBn: true } } },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      }),
      prisma.madrasaClass.findMany({
        where: { madrasaId, isActive: 1, deletedAt: null },
        select: { classId: true, class: { select: { nameBn: true, divisionId: true } } },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      }),
    ]);

    const divisionOrder = new Map(divisions.map((d, index) => [d.divisionId, index]));
    const divisionName = new Map(divisions.map((d) => [d.divisionId, d.division.nameBn]));

    return classes
      .filter((c) => c.class.divisionId !== null && divisionOrder.has(c.class.divisionId))
      .map((c, index) => ({
        classId: c.classId,
        className: c.class.nameBn,
        divisionId: c.class.divisionId as number,
        divisionName: divisionName.get(c.class.divisionId as number) ?? null,
        order: index,
      }))
      .sort(
        (a, b) =>
          (divisionOrder.get(a.divisionId) ?? 0) - (divisionOrder.get(b.divisionId) ?? 0) || a.order - b.order,
      );
  }

  /** Every পরীক্ষার ফি row linked to an exam (optionally one exam), with how
   * many invoices already point at it - a billed row is never hard-deleted. */
  findExamFeeRows(madrasaId: number, examId?: number) {
    return prisma.feeStructure.findMany({
      where: { madrasaId, feeType: EXAM_FEE_CATEGORY_NAME, examId: examId ?? { not: null } },
      select: {
        id: true,
        examId: true,
        classId: true,
        amount: true,
        isActive: true,
        sessionId: true,
        _count: { select: { invoices: true } },
      },
      orderBy: { id: "asc" },
    });
  }

  /** Amount a class last had for any exam - the default when an exam newly
   * covers this class (e.g. its বিভাগ scope just grew). */
  findLatestExamFeeAmount(madrasaId: number, classId: number) {
    return prisma.feeStructure.findFirst({
      where: { madrasaId, feeType: EXAM_FEE_CATEGORY_NAME, examId: { not: null }, classId },
      orderBy: { id: "desc" },
      select: { amount: true },
    });
  }

  /** Super-admin পরীক্ষার ফি template: class-specific first, generic (null class) as fallback. */
  async findTemplateExamFeeAmount(classId: number) {
    const rows = await prisma.defaultFeeStructure.findMany({
      where: { feeType: EXAM_FEE_CATEGORY_NAME, isActive: true, OR: [{ classId }, { classId: null }] },
      select: { classId: true, amount: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    return rows.find((r) => r.classId === classId) ?? rows.find((r) => r.classId === null) ?? null;
  }

  createRow(data: {
    madrasaId: number;
    examId: number;
    classId: number;
    amount: Prisma.Decimal | number;
    isActive: boolean;
    sessionId: number;
    academicYear: string;
  }) {
    return prisma.feeStructure.create({
      data: {
        ...data,
        name: EXAM_FEE_CATEGORY_NAME,
        feeType: EXAM_FEE_CATEGORY_NAME,
        frequency: "ONE_TIME",
      },
    });
  }

  updateRow(id: number, madrasaId: number, data: Prisma.FeeStructureUpdateManyMutationInput) {
    return prisma.feeStructure.updateMany({ where: { id, madrasaId }, data });
  }

  deleteRow(id: number, madrasaId: number) {
    return prisma.feeStructure.deleteMany({ where: { id, madrasaId } });
  }
}

export const examFeeRepository = new ExamFeeRepository();
