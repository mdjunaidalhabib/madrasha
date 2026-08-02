import { prisma } from "../../shared/database/prisma";

export class TrashRepository {
  /* ================= LIST ================= */

  findTrashedStudents(madrasaId: number) {
    return prisma.student.findMany({
      where: { madrasaId, deletedAt: { not: null } },
      include: { classRef: { select: { nameBn: true } } },
      orderBy: { deletedAt: "desc" },
    });
  }

  findTrashedTeachers(madrasaId: number) {
    return prisma.teacher.findMany({
      where: { madrasaId, deletedAt: { not: null } },
      include: { divisionRef: { select: { nameBn: true } } },
      orderBy: { deletedAt: "desc" },
    });
  }

  findTrashedExams(madrasaId: number) {
    return prisma.exam.findMany({
      where: { madrasaId, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
    });
  }

  /* ================= RESTORE ================= */

  restoreStudent(id: number, madrasaId: number) {
    return prisma.student.updateMany({
      where: { id, madrasaId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
  }

  restoreTeacher(id: number, madrasaId: number) {
    return prisma.teacher.updateMany({
      where: { id, madrasaId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
  }

  restoreExam(id: number, madrasaId: number) {
    return prisma.exam.updateMany({
      where: { id, madrasaId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
  }

  /* ================= PERMANENT DELETE ================= */

  // Student's child rows (ResultSummary, Mark, PromotionRecord, Invoice,
  // GuardianStudent) are all `onDelete: Cascade` in the schema, so a plain
  // delete is enough.
  permanentDeleteStudent(id: number, madrasaId: number) {
    return prisma.student.deleteMany({ where: { id, madrasaId, deletedAt: { not: null } } });
  }

  // Same reasoning as students — Teacher's children (PayrollRecord,
  // TeacherAssignment) are Cascade, ClassRoutine.teacher is SetNull.
  permanentDeleteTeacher(id: number, madrasaId: number) {
    return prisma.teacher.deleteMany({ where: { id, madrasaId, deletedAt: { not: null } } });
  }

  /** Unlike Student/Teacher, `Mark.exam` and `ResultMaster.exam` are
   * `onDelete: Restrict` — a plain `exam.delete` would fail with a FK error
   * the moment any marks/results exist. Explicitly clear those first. */
  async permanentDeleteExam(id: number, madrasaId: number): Promise<number> {
    const exam = await prisma.exam.findFirst({
      where: { id, madrasaId, deletedAt: { not: null } },
      select: { id: true },
    });
    if (!exam) return 0;

    await prisma.$transaction([
      prisma.mark.deleteMany({ where: { examId: id } }),
      prisma.resultMaster.deleteMany({ where: { examId: id } }),
      prisma.examRoutine.deleteMany({ where: { examId: id } }),
      prisma.exam.delete({ where: { id } }),
    ]);
    return 1;
  }

  /** Background sweep (not tenant-scoped) — permanently removes anything
   * left untouched in Trash past the retention cutoff, across every
   * madrasa. Reuses the same cascade-safe ordering as the manual delete. */
  async purgeExpired(
    cutoff: Date,
  ): Promise<{ students: number; teachers: number; exams: number }> {
    const [expiredStudents, expiredTeachers, expiredExams] = await Promise.all([
      prisma.student.findMany({ where: { deletedAt: { lt: cutoff } }, select: { id: true } }),
      prisma.teacher.findMany({ where: { deletedAt: { lt: cutoff } }, select: { id: true } }),
      prisma.exam.findMany({ where: { deletedAt: { lt: cutoff } }, select: { id: true } }),
    ]);

    if (expiredStudents.length) {
      await prisma.student.deleteMany({
        where: { id: { in: expiredStudents.map((s) => s.id) } },
      });
    }
    if (expiredTeachers.length) {
      await prisma.teacher.deleteMany({
        where: { id: { in: expiredTeachers.map((t) => t.id) } },
      });
    }
    if (expiredExams.length) {
      const examIds = expiredExams.map((e) => e.id);
      await prisma.$transaction([
        prisma.mark.deleteMany({ where: { examId: { in: examIds } } }),
        prisma.resultMaster.deleteMany({ where: { examId: { in: examIds } } }),
        prisma.examRoutine.deleteMany({ where: { examId: { in: examIds } } }),
        prisma.exam.deleteMany({ where: { id: { in: examIds } } }),
      ]);
    }

    return {
      students: expiredStudents.length,
      teachers: expiredTeachers.length,
      exams: expiredExams.length,
    };
  }
}

export const trashRepository = new TrashRepository();
