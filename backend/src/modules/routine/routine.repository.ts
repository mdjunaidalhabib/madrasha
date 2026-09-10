import { prisma } from "../../shared/database/prisma";

export class RoutineRepository {
  /* ================= CLASS ROUTINE ================= */

  findClassRoutines(madrasaId: number, classId?: number) {
    return prisma.classRoutine.findMany({
      where: { madrasaId, ...(classId ? { classId } : {}) },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      include: { class: { select: { nameBn: true, name: true } }, teacher: { select: { nameBn: true } } },
    });
  }

  createClassRoutine(madrasaId: number, data: Record<string, unknown>) {
    return prisma.classRoutine.create({ data: { ...data, madrasaId } as any });
  }

  updateClassRoutine(id: number, madrasaId: number, data: Record<string, unknown>) {
    return prisma.classRoutine.updateMany({ where: { id, madrasaId }, data });
  }

  deleteClassRoutine(id: number, madrasaId: number) {
    return prisma.classRoutine.deleteMany({ where: { id, madrasaId } });
  }

  /* ================= EXAM ROUTINE ================= */

  findExamRoutines(madrasaId: number, examId?: number, classId?: number) {
    return prisma.examRoutine.findMany({
      where: {
        madrasaId,
        exam: { deletedAt: null },
        ...(examId ? { examId } : {}),
        ...(classId ? { classId } : {}),
      },
      orderBy: [{ examDate: "asc" }, { startTime: "asc" }],
      include: {
        class: { select: { nameBn: true, name: true } },
        exam: { select: { name: true, year: true } },
        room: { select: { name: true, code: true } },
      },
    });
  }

  createExamRoutine(madrasaId: number, data: Record<string, unknown>) {
    return prisma.examRoutine.create({ data: { ...data, madrasaId } as any });
  }

  updateExamRoutine(id: number, madrasaId: number, data: Record<string, unknown>) {
    return prisma.examRoutine.updateMany({ where: { id, madrasaId }, data });
  }

  deleteExamRoutine(id: number, madrasaId: number) {
    return prisma.examRoutine.deleteMany({ where: { id, madrasaId } });
  }

  findExamRoutineById(id: number, madrasaId: number) {
    return prisma.examRoutine.findFirst({ where: { id, madrasaId } });
  }

  /** Other exam routines in the same room on the same date, for the
   * service layer to run its time-overlap check against (see
   * timeRangesOverlap in shared/utils/time-range.util.ts). */
  findRoutinesByRoomAndDate(madrasaId: number, roomId: number, examDate: Date, excludeId?: number) {
    return prisma.examRoutine.findMany({
      where: {
        madrasaId,
        roomId,
        examDate,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, startTime: true, endTime: true },
    });
  }

  findDuplicateClassSubject(
    madrasaId: number,
    examId: number,
    classId: number,
    subject: string,
    excludeId?: number,
  ) {
    return prisma.examRoutine.findFirst({
      where: {
        madrasaId,
        examId,
        classId,
        subject: { equals: subject, mode: "insensitive" },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
  }
}

export const routineRepository = new RoutineRepository();
