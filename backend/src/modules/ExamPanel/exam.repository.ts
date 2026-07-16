import { prisma } from "../../shared/database/prisma";
import { FAIL_MARK_SETTING_NAME } from "./exam.constants";

export class ExamRepository {
  findExams(madrasaId: number) {
    return prisma.exam.findMany({ where: { madrasaId }, orderBy: { id: "desc" } });
  }

  createExam(madrasaId: number, name: string, year: string) {
    return prisma.exam.create({ data: { name, year, madrasaId } });
  }

  deleteExam(id: number, madrasaId: number) {
    return prisma.exam.deleteMany({ where: { id, madrasaId } });
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
