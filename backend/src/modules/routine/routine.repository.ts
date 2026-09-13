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

  /* ================= OVERVIEW (routine landing page) ================= */

  /** Every active class for this madrasa, alongside how many weekly
   * class-routine periods already exist for it - lets the frontend show
   * "রুটিন আছে/নেই" at a glance without picking a division/class first. */
  async findClassRoutineOverview(madrasaId: number) {
    const [madrasaClasses, counts] = await Promise.all([
      prisma.madrasaClass.findMany({
        where: { madrasaId, deletedAt: null, isActive: 1 },
        include: { class: { include: { division: { select: { name: true, nameBn: true } } } } },
        orderBy: [{ sortOrder: "asc" }],
      }),
      prisma.classRoutine.groupBy({ by: ["classId"], where: { madrasaId }, _count: { _all: true } }),
    ]);

    const countByClassId = new Map(counts.map((c) => [c.classId, c._count._all]));

    return madrasaClasses
      .filter((mc) => mc.class)
      .map((mc) => ({
        classId: mc.classId,
        className: mc.class!.nameBn || mc.class!.name,
        divisionId: mc.class!.divisionId,
        divisionName: mc.class!.division?.nameBn || mc.class!.division?.name || null,
        periodCount: countByClassId.get(mc.classId) || 0,
      }));
  }

  /** Every active exam x active class combination, alongside how many exam
   * routine entries already exist and their combined status - the same
   * "cross-join + left-join" idea as the Result panel's overview, so the
   * routine builder page can show class-by-class progress on load. */
  async findExamRoutineOverview(madrasaId: number) {
    const [madrasaClasses, exams, routines] = await Promise.all([
      prisma.madrasaClass.findMany({
        where: { madrasaId, deletedAt: null, isActive: 1 },
        include: { class: { include: { division: { select: { name: true, nameBn: true } } } } },
        orderBy: [{ sortOrder: "asc" }],
      }),
      prisma.exam.findMany({
        where: { madrasaId, isActive: true },
        orderBy: [{ sortOrder: "asc" }],
        select: { id: true, name: true, year: true },
      }),
      prisma.examRoutine.findMany({
        where: { madrasaId, exam: { madrasaId, isActive: true } },
        select: { examId: true, classId: true, status: true },
      }),
    ]);

    const byKey = new Map<string, { count: number; statuses: Set<string> }>();
    for (const r of routines) {
      const key = `${r.examId}:${r.classId}`;
      const entry = byKey.get(key) || { count: 0, statuses: new Set<string>() };
      entry.count += 1;
      entry.statuses.add(r.status);
      byKey.set(key, entry);
    }

    const classRows = madrasaClasses.filter((mc) => mc.class);
    const rows: Array<{
      examId: number;
      examName: string;
      examYear: string;
      classId: number;
      className: string | null;
      divisionId: number | null;
      divisionName: string | null;
      subjectCount: number;
      status: "NONE" | "DRAFT" | "PUBLISHED" | "CANCELLED" | "MIXED";
    }> = [];

    for (const exam of exams) {
      for (const mc of classRows) {
        const entry = byKey.get(`${exam.id}:${mc.classId}`);
        const statuses = entry ? Array.from(entry.statuses) : [];
        let status: "NONE" | "DRAFT" | "PUBLISHED" | "CANCELLED" | "MIXED" = "NONE";
        if (statuses.length) {
          status = statuses.every((s) => s === statuses[0]) ? (statuses[0] as any) : "MIXED";
        }
        rows.push({
          examId: exam.id,
          examName: exam.name,
          examYear: exam.year,
          classId: mc.classId,
          className: mc.class!.nameBn || mc.class!.name,
          divisionId: mc.class!.divisionId,
          divisionName: mc.class!.division?.nameBn || mc.class!.division?.name || null,
          subjectCount: entry?.count || 0,
          status,
        });
      }
    }

    return rows;
  }
}

export const routineRepository = new RoutineRepository();
