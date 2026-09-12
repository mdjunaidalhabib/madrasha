import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

export class ExamInvigilatorRepository {
  findByRoutine(madrasaId: number, examRoutineId: number) {
    return prisma.examInvigilatorAssignment.findMany({
      where: { madrasaId, examRoutineId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });
  }

  create(madrasaId: number, data: Record<string, unknown>, db: Db = prisma) {
    return db.examInvigilatorAssignment.create({ data: { ...data, madrasaId } as any });
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

  /** Confirms the Teacher/Staff id being assigned as invigilator actually
   * belongs to this tenant, before an assignment row is created pointing at
   * it - see exam-invigilator.service.ts's assign(). */
  async invigilatorExists(madrasaId: number, invigilatorType: string, invigilatorId: number): Promise<boolean> {
    if (invigilatorType === "TEACHER") {
      const teacher = await prisma.teacher.findFirst({ where: { id: invigilatorId, madrasaId, deletedAt: null } });
      return !!teacher;
    }
    const staff = await prisma.staff.findFirst({ where: { id: invigilatorId, madrasaId, deletedAt: null } });
    return !!staff;
  }

  /** Other slots this person is already assigned to on the same date, for
   * the service layer's time-overlap check (see time-range.util.ts). */
  findOtherAssignmentsForPersonOnDate(
    madrasaId: number,
    invigilatorType: string,
    invigilatorId: number,
    examDate: Date,
    excludeExamRoutineId: number,
    db: Db = prisma,
  ) {
    return db.examInvigilatorAssignment.findMany({
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
