import { prisma } from "../../shared/database/prisma";
import { FAIL_MARK_SETTING_NAME } from "./exam.constants";

export class ExamRepository {
  findExams(madrasaId: number) {
    return prisma.exam.findMany({
      where: { madrasaId, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
  }

  async createExam(madrasaId: number, name: string, year: string) {
    const last = await prisma.exam.findFirst({
      where: { madrasaId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    return prisma.exam.create({
      data: { name, year, madrasaId, sortOrder: (last?.sortOrder ?? -1) + 1 },
    });
  }

  updateExam(id: number, madrasaId: number, name: string, year: string) {
    return prisma.exam.updateMany({
      where: { id, madrasaId, deletedAt: null },
      data: { name, year },
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

  findGeneralGrades(madrasaId: number) {
    return prisma.generalGrade.findMany({
      where: { madrasaId },
      orderBy: [{ maxMark: "desc" }, { id: "desc" }],
    });
  }

  createGeneralGrade(madrasaId: number, name: string, minMark: number, maxMark: number) {
    return prisma.generalGrade.create({ data: { name, minMark, maxMark, madrasaId } });
  }

  deleteGeneralGrade(id: number, madrasaId: number) {
    return prisma.generalGrade.deleteMany({ where: { id, madrasaId } });
  }

  findMadrasaGrades(madrasaId: number) {
    return prisma.madrasaGrade.findMany({
      where: { madrasaId },
      orderBy: [{ maxMark: "desc" }, { id: "desc" }],
    });
  }

  createMadrasaGrade(madrasaId: number, name: string, minMark: number, maxMark: number) {
    return prisma.madrasaGrade.create({ data: { name, minMark, maxMark, madrasaId } });
  }

  deleteMadrasaGrade(id: number, madrasaId: number) {
    return prisma.madrasaGrade.deleteMany({ where: { id, madrasaId } });
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
