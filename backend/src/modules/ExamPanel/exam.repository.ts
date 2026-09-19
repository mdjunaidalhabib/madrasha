import { prisma } from "../../shared/database/prisma";
import { FAIL_MARK_SETTING_NAME } from "./exam.constants";

export class ExamRepository {
  findExams(madrasaId: number, activeOnly = false) {
    return prisma.exam.findMany({
      where: { madrasaId, deletedAt: null, ...(activeOnly ? { isActive: true } : {}) },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: { _count: { select: { feeStructures: { where: { isActive: true } } } } },
    });
  }

  findExamById(id: number, madrasaId: number) {
    return prisma.exam.findFirst({ where: { id, madrasaId, deletedAt: null } });
  }

  async createExam(madrasaId: number, name: string, year: string, extra: Record<string, unknown> = {}) {
    const last = await prisma.exam.findFirst({
      where: { madrasaId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    return prisma.exam.create({
      data: { name, year, madrasaId, sortOrder: (last?.sortOrder ?? -1) + 1, ...extra },
    });
  }

  updateExam(id: number, madrasaId: number, data: Record<string, unknown>) {
    return prisma.exam.updateMany({
      where: { id, madrasaId, deletedAt: null },
      data,
    });
  }

  updateExamStatus(id: number, madrasaId: number, status: string) {
    return prisma.exam.updateMany({
      where: { id, madrasaId, deletedAt: null },
      data: { status: status as any },
    });
  }

  // Soft delete — moves the exam to Trash instead of hard-deleting it. This
  // also sidesteps the FK error that used to happen when marks/results
  // already existed for the exam (Mark.exam/ResultMaster.exam are Restrict).
  deleteExam(id: number, madrasaId: number) {
    return prisma.exam.updateMany({
      where: { id, madrasaId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  /** Sets sortOrder = array index for each exam id, in one transaction - used
   * after a drag-and-drop reorder in the UI. Only touches exams that belong
   * to this madrasa; unknown/foreign ids are silently ignored. */
  async reorderExams(madrasaId: number, orderedIds: number[]): Promise<void> {
    const owned = await prisma.exam.findMany({
      where: { madrasaId, id: { in: orderedIds }, deletedAt: null },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((exam) => exam.id));

    const updates = orderedIds
      .filter((id) => ownedIds.has(id))
      .map((id, index) => prisma.exam.update({ where: { id }, data: { sortOrder: index } }));

    if (updates.length) await prisma.$transaction(updates);
  }

  /** `divisionId` null = the madrasa-wide default scale; a number = that
   * division's own scale. Defaults to the default scale so callers that
   * predate per-division grading are unaffected. */
  findGeneralGrades(madrasaId: number, divisionId: number | null = null) {
    return prisma.generalGrade.findMany({
      where: { madrasaId, divisionId },
      orderBy: [{ maxMark: "desc" }, { id: "desc" }],
    });
  }

  createGeneralGrade(
    madrasaId: number,
    name: string,
    minMark: number,
    maxMark: number,
    point: number | null,
    divisionId: number | null = null,
  ) {
    return prisma.generalGrade.create({ data: { name, minMark, maxMark, point, madrasaId, divisionId } });
  }

  createManyGeneralGrades(
    madrasaId: number,
    divisionId: number,
    grades: { name: string; minMark: number; maxMark: number; point: number | null }[],
  ) {
    return prisma.generalGrade.createMany({
      data: grades.map((g) => ({
        madrasaId,
        divisionId,
        name: g.name,
        minMark: g.minMark,
        maxMark: g.maxMark,
        point: g.point,
      })),
      skipDuplicates: true,
    });
  }

  updateGeneralGrade(
    id: number,
    madrasaId: number,
    name: string,
    minMark: number,
    maxMark: number,
    point: number | null,
  ) {
    return prisma.generalGrade.updateMany({
      where: { id, madrasaId },
      data: { name, minMark, maxMark, point },
    });
  }

  deleteGeneralGrade(id: number, madrasaId: number) {
    return prisma.generalGrade.deleteMany({ where: { id, madrasaId } });
  }

  /** `divisionId` null = the madrasa-wide default scale; a number = that
   * division's own scale. Defaults to the default scale so callers that
   * predate per-division grading are unaffected. */
  findMadrasaGrades(madrasaId: number, divisionId: number | null = null) {
    return prisma.madrasaGrade.findMany({
      where: { madrasaId, divisionId },
      orderBy: [{ maxMark: "desc" }, { id: "desc" }],
    });
  }

  createMadrasaGrade(
    madrasaId: number,
    name: string,
    minMark: number,
    maxMark: number,
    point: number | null,
    divisionId: number | null = null,
  ) {
    return prisma.madrasaGrade.create({ data: { name, minMark, maxMark, point, madrasaId, divisionId } });
  }

  createManyMadrasaGrades(
    madrasaId: number,
    divisionId: number,
    grades: { name: string; minMark: number; maxMark: number; point: number | null }[],
  ) {
    return prisma.madrasaGrade.createMany({
      data: grades.map((g) => ({
        madrasaId,
        divisionId,
        name: g.name,
        minMark: g.minMark,
        maxMark: g.maxMark,
        point: g.point,
      })),
      skipDuplicates: true,
    });
  }

  updateMadrasaGrade(
    id: number,
    madrasaId: number,
    name: string,
    minMark: number,
    maxMark: number,
    point: number | null,
  ) {
    return prisma.madrasaGrade.updateMany({
      where: { id, madrasaId },
      data: { name, minMark, maxMark, point },
    });
  }

  deleteMadrasaGrade(id: number, madrasaId: number) {
    return prisma.madrasaGrade.deleteMany({ where: { id, madrasaId } });
  }

  /* ================= DIVISION FAIL MARK ================= */

  /** This madrasa's active (activated, not deleted) divisions, in its own order. */
  findActiveDivisions(madrasaId: number) {
    return prisma.madrasaDivision.findMany({
      where: { madrasaId, isActive: 1, deletedAt: null },
      select: {
        divisionId: true,
        failMark: true,
        division: { select: { name: true, nameBn: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
  }

  findActiveDivision(madrasaId: number, divisionId: number) {
    return prisma.madrasaDivision.findFirst({
      where: { madrasaId, divisionId, isActive: 1, deletedAt: null },
      select: { divisionId: true, failMark: true },
    });
  }

  /** Divisions that own at least one grade row of either kind. */
  async findDivisionIdsWithOwnGrades(madrasaId: number): Promise<Set<number>> {
    const [general, madrasa] = await Promise.all([
      prisma.generalGrade.findMany({
        where: { madrasaId, divisionId: { not: null } },
        select: { divisionId: true },
        distinct: ["divisionId"],
      }),
      prisma.madrasaGrade.findMany({
        where: { madrasaId, divisionId: { not: null } },
        select: { divisionId: true },
        distinct: ["divisionId"],
      }),
    ]);
    const ids = new Set<number>();
    for (const row of [...general, ...madrasa]) if (row.divisionId !== null) ids.add(row.divisionId);
    return ids;
  }

  /** Class.divisionId (Class is the global catalog row, not MadrasaClass). */
  async findClassDivisionId(classId: number): Promise<number | null> {
    const row = await prisma.class.findUnique({ where: { id: classId }, select: { divisionId: true } });
    return row?.divisionId ?? null;
  }

  setDivisionFailMark(madrasaId: number, divisionId: number, failMark: number | null) {
    return prisma.madrasaDivision.updateMany({
      where: { madrasaId, divisionId, isActive: 1, deletedAt: null },
      data: { failMark },
    });
  }

  /** Clears the override and drops the division's own grade rows in one
   * transaction, so the division falls back to the madrasa-wide defaults. */
  async clearDivisionOverride(madrasaId: number, divisionId: number) {
    await prisma.$transaction([
      prisma.madrasaDivision.updateMany({ where: { madrasaId, divisionId }, data: { failMark: null } }),
      prisma.generalGrade.deleteMany({ where: { madrasaId, divisionId } }),
      prisma.madrasaGrade.deleteMany({ where: { madrasaId, divisionId } }),
    ]);
  }

  findFailMarkSetting(madrasaId: number) {
    return prisma.setting.findFirst({
      where: { name: FAIL_MARK_SETTING_NAME, madrasaId },
      select: { value: true },
    });
  }

  upsertFailMarkSetting(madrasaId: number, value: string) {
    return prisma.setting.upsert({
      where: { madrasaId_name: { madrasaId, name: FAIL_MARK_SETTING_NAME } },
      update: { value },
      create: { name: FAIL_MARK_SETTING_NAME, value, madrasaId },
    });
  }
}

export const examRepository = new ExamRepository();
