import { prisma } from "../../shared/database/prisma";

export class ExamInvigilatorRepository {
  findByRoutine(madrasaId: number, examRoutineId: number) {
    return prisma.examInvigilatorAssignment.findMany({
      where: { madrasaId, examRoutineId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });
  }

  create(madrasaId: number, data: Record<string, unknown>) {
    return prisma.examInvigilatorAssignment.create({ data: { ...data, madrasaId } as any });
  }

  updateStatus(id: number, madrasaId: number, data: Record<string, unknown>) {
    return prisma.examInvigilatorAssignment.updateMany({ where: { id, madrasaId }, data });
  }

  remove(id: number, madrasaId: number) {
    return prisma.examInvigilatorAssignment.deleteMany({ where: { id, madrasaId } });
  }

  findRoutineDateTime(id: number, madrasaId: number) {
    return prisma.examRoutine.findFirst({
      where: { id, madrasaId },
      select: { id: true, examDate: true, startTime: true, endTime: true },
    });
  }

  /** Other slots this person is already assigned to on the same date, for
   * the service layer's time-overlap check (see time-range.util.ts). */
  findOtherAssignmentsForPersonOnDate(
    madrasaId: number,
    invigilatorType: string,
    invigilatorId: number,
    examDate: Date,
    excludeExamRoutineId: number,
  ) {
    return prisma.examInvigilatorAssignment.findMany({
      where: {
        madrasaId,
        invigilatorType: invigilatorType as any,
        invigilatorId,
        status: { not: "CANCELLED" },
        examRoutine: {
          examDate,
          id: { not: excludeExamRoutineId },
        },
      },
      select: { id: true, examRoutine: { select: { id: true, startTime: true, endTime: true } } },
    });
  }
}

export const examInvigilatorRepository = new ExamInvigilatorRepository();
