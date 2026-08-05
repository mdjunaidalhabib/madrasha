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

  findTrashedDivisions(madrasaId: number) {
    return prisma.madrasaDivision.findMany({
      where: { madrasaId, deletedAt: { not: null } },
      include: { division: { select: { nameBn: true, name: true } } },
      orderBy: { deletedAt: "desc" },
    });
  }

  findTrashedClasses(madrasaId: number) {
    return prisma.madrasaClass.findMany({
      where: { madrasaId, deletedAt: { not: null } },
      include: { class: { select: { nameBn: true, name: true, division: { select: { nameBn: true } } } } },
      orderBy: { deletedAt: "desc" },
    });
  }

  findTrashedBooks(madrasaId: number) {
    return prisma.madrasaBook.findMany({
      where: { madrasaId, deletedAt: { not: null } },
      include: { book: { select: { nameBn: true, name: true } } },
      orderBy: { deletedAt: "desc" },
    });
  }

  findTrashedResults(madrasaId: number) {
    return prisma.resultMaster.findMany({
      where: { madrasaId, deletedAt: { not: null } },
      include: {
        exam: { select: { name: true, year: true } },
        class: { select: { nameBn: true, name: true } },
      },
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

  restoreDivision(id: number, madrasaId: number) {
    return prisma.madrasaDivision.updateMany({
      where: { id, madrasaId, deletedAt: { not: null } },
      data: { deletedAt: null, isActive: 1 },
    });
  }

  restoreClass(id: number, madrasaId: number) {
    return prisma.madrasaClass.updateMany({
      where: { id, madrasaId, deletedAt: { not: null } },
      data: { deletedAt: null, isActive: 1 },
    });
  }

  restoreBook(id: number, madrasaId: number) {
    return prisma.madrasaBook.updateMany({
      where: { id, madrasaId, deletedAt: { not: null } },
      data: { deletedAt: null, isActive: 1 },
    });
  }

  restoreResult(id: number, madrasaId: number) {
    return prisma.resultMaster.updateMany({
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

  // Division/Class are global-catalog join rows with no FK-dependent
  // children of their own (Mark/ResultMaster reference the global
  // Class/Book directly, not these join tables) — a plain delete is safe
  // and never touches the shared catalog row other tenants still use.
  permanentDeleteDivision(id: number, madrasaId: number) {
    return prisma.madrasaDivision.deleteMany({ where: { id, madrasaId, deletedAt: { not: null } } });
  }

  permanentDeleteClass(id: number, madrasaId: number) {
    return prisma.madrasaClass.deleteMany({ where: { id, madrasaId, deletedAt: { not: null } } });
  }

  /** Book/MadrasaBook is the one join row with real dependent data. Its
   * Marks are deliberately preserved while the book sits in Trash, so only
   * now — permanent delete — are they actually removed. */
  async permanentDeleteBook(id: number, madrasaId: number): Promise<number> {
    const link = await prisma.madrasaBook.findFirst({
      where: { id, madrasaId, deletedAt: { not: null } },
      select: { bookId: true },
    });
    if (!link) return 0;

    await prisma.$transaction([
      prisma.mark.deleteMany({ where: { madrasaId, bookId: link.bookId } }),
      prisma.madrasaBook.delete({ where: { id } }),
    ]);
    return 1;
  }

  /** Reuses the exact transaction that used to run synchronously on the
   * normal "delete result" button — now deferred until permanent delete. */
  async permanentDeleteResult(id: number, madrasaId: number): Promise<number> {
    const master = await prisma.resultMaster.findFirst({
      where: { id, madrasaId, deletedAt: { not: null } },
      select: { id: true },
    });
    if (!master) return 0;

    await prisma.$transaction([
      prisma.mark.deleteMany({ where: { resultMasterId: id } }),
      prisma.resultSummary.deleteMany({ where: { resultMasterId: id } }),
      prisma.resultMaster.delete({ where: { id } }),
    ]);
    return 1;
  }

  /** Background sweep (not tenant-scoped) — permanently removes anything
   * left untouched in Trash past the retention cutoff, across every
   * madrasa. Reuses the same cascade-safe ordering as the manual delete. */
  async purgeExpired(cutoff: Date): Promise<{
    students: number;
    teachers: number;
    exams: number;
    divisions: number;
    classes: number;
    books: number;
    results: number;
  }> {
    const [expiredStudents, expiredTeachers, expiredExams, expiredDivisions, expiredClasses, expiredBooks, expiredResults] =
      await Promise.all([
        prisma.student.findMany({ where: { deletedAt: { lt: cutoff } }, select: { id: true } }),
        prisma.teacher.findMany({ where: { deletedAt: { lt: cutoff } }, select: { id: true } }),
        prisma.exam.findMany({ where: { deletedAt: { lt: cutoff } }, select: { id: true } }),
        prisma.madrasaDivision.findMany({ where: { deletedAt: { lt: cutoff } }, select: { id: true } }),
        prisma.madrasaClass.findMany({ where: { deletedAt: { lt: cutoff } }, select: { id: true } }),
        prisma.madrasaBook.findMany({
          where: { deletedAt: { lt: cutoff } },
          select: { id: true, bookId: true, madrasaId: true },
        }),
        prisma.resultMaster.findMany({ where: { deletedAt: { lt: cutoff } }, select: { id: true } }),
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
    if (expiredDivisions.length) {
      await prisma.madrasaDivision.deleteMany({
        where: { id: { in: expiredDivisions.map((d) => d.id) } },
      });
    }
    if (expiredClasses.length) {
      await prisma.madrasaClass.deleteMany({
        where: { id: { in: expiredClasses.map((c) => c.id) } },
      });
    }
    if (expiredBooks.length) {
      await prisma.$transaction([
        prisma.mark.deleteMany({
          where: { OR: expiredBooks.map((b) => ({ madrasaId: b.madrasaId, bookId: b.bookId })) },
        }),
        prisma.madrasaBook.deleteMany({ where: { id: { in: expiredBooks.map((b) => b.id) } } }),
      ]);
    }
    if (expiredResults.length) {
      const resultIds = expiredResults.map((r) => r.id);
      await prisma.$transaction([
        prisma.mark.deleteMany({ where: { resultMasterId: { in: resultIds } } }),
        prisma.resultSummary.deleteMany({ where: { resultMasterId: { in: resultIds } } }),
        prisma.resultMaster.deleteMany({ where: { id: { in: resultIds } } }),
      ]);
    }

    return {
      students: expiredStudents.length,
      teachers: expiredTeachers.length,
      exams: expiredExams.length,
      divisions: expiredDivisions.length,
      classes: expiredClasses.length,
      books: expiredBooks.length,
      results: expiredResults.length,
    };
  }
}

export const trashRepository = new TrashRepository();
