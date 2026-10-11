import { prisma } from "../../shared/database/prisma";
import { resultPanelRepository } from "../ResultPanel/result-panel.repository";
import { tenantClassNameSelect, tenantDivisionNameSelect, withTenantClassName, withTenantDivisionName } from "../../shared/utils/tenant-name.util";

export interface RestoreImpactMaster {
  id: number;
  status: string;
  examName: string;
  examYear: string | null;
}

export class TrashRepository {
  /* ================= LIST ================= */

  async findTrashedStudents(madrasaId: number) {
    const rows = await prisma.student.findMany({
      where: { madrasaId, deletedAt: { not: null } },
      include: { classRef: { select: tenantClassNameSelect(madrasaId) } },
      orderBy: { deletedAt: "desc" },
    });
    return rows.map((r) => ({ ...r, classRef: withTenantClassName(r.classRef) }));
  }

  async findTrashedTeachers(madrasaId: number) {
    const rows = await prisma.teacher.findMany({
      where: { madrasaId, deletedAt: { not: null } },
      include: { divisionRef: { select: tenantDivisionNameSelect(madrasaId) } },
      orderBy: { deletedAt: "desc" },
    });
    return rows.map((r) => ({ ...r, divisionRef: withTenantDivisionName(r.divisionRef) }));
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
      include: {
        class: {
          select: { nameBn: true, name: true, division: { select: tenantDivisionNameSelect(madrasaId) } },
        },
      },
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
        class: { select: tenantClassNameSelect(madrasaId) },
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

  /** Result sessions of the student's class that a restore would affect:
   * processed (or further) sessions in which the student has NO summary row
   * yet, and for which the student is an "old" student (record created at or
   * before the session was processed - a student admitted afterwards is a new
   * admission and never enters an old result). With ExamCandidate rows
   * present for the exam, only a registered candidate is affected (same
   * roster rule as ResultPanelRepository.findRequiredStudentsInClass).
   * Returns null when the student is not in the trash. */
  async findStudentRestoreImpact(id: number, madrasaId: number) {
    const student = await prisma.student.findFirst({
      where: { id, madrasaId, deletedAt: { not: null } },
      select: { id: true, classId: true, createdAt: true, isActive: true, admissionStatus: true },
    });
    if (!student) return null;

    // An inactive / not-approved student is not part of any marks roster, so
    // bringing them back cannot disturb a result.
    if (student.isActive !== 1 || student.admissionStatus !== "APPROVED") {
      return { student, masters: [] as RestoreImpactMaster[] };
    }

    const candidates = await prisma.resultMaster.findMany({
      where: {
        madrasaId,
        classId: student.classId,
        deletedAt: null,
        status: { not: "DRAFT" },
        summary: { none: { studentId: id } },
      },
      select: {
        id: true,
        examId: true,
        classId: true,
        status: true,
        processedAt: true,
        exam: { select: { name: true, year: true } },
      },
      orderBy: { id: "asc" },
    });

    const masters: RestoreImpactMaster[] = [];
    for (const m of candidates) {
      // New admission: created after this result was processed.
      if (m.processedAt && student.createdAt > m.processedAt) continue;

      const participants = await resultPanelRepository.findParticipatingCandidatesInClass(
        madrasaId,
        m.examId,
        m.classId,
      );
      if (participants.length && !participants.some((p) => p.id === id)) continue;

      masters.push({
        id: m.id,
        status: m.status,
        examName: m.exam?.name ?? "",
        examYear: m.exam?.year ?? null,
      });
    }
    return { student, masters };
  }

  /** Restores the student AND re-opens the given result sessions in ONE
   * transaction (all-or-nothing): each session's summary is removed, its
   * sign-off timestamps cleared, status set back to DRAFT (guardians only
   * read PUBLISHED/LOCKED, so it disappears from the portal immediately) and
   * every SUBMITTED/VERIFIED subject submission goes back to DRAFT so marks
   * can be entered for the returning student and re-verified. Marks of every
   * other student are untouched. `processedAt` is kept on purpose (it is the
   * new-admission cutoff). LOCKED sessions are never passed in here. */
  restoreStudentAndReopenResults(
    id: number,
    madrasaId: number,
    reopenResultMasterIds: number[],
    note: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const restored = await tx.student.updateMany({
        where: { id, madrasaId, deletedAt: { not: null } },
        data: { deletedAt: null },
      });
      if (!restored.count || !reopenResultMasterIds.length) return restored;

      await tx.resultSummary.deleteMany({
        where: { resultMasterId: { in: reopenResultMasterIds } },
      });
      await tx.markSubmission.updateMany({
        where: {
          resultMasterId: { in: reopenResultMasterIds },
          status: { in: ["SUBMITTED", "VERIFIED"] },
        },
        data: { status: "DRAFT", comment: note },
      });
      await tx.resultMaster.updateMany({
        where: { id: { in: reopenResultMasterIds }, madrasaId, status: { not: "LOCKED" } },
        data: {
          status: "DRAFT",
          publishedAt: null,
          publishedBy: null,
          approvedAt: null,
          approvedBy: null,
          resultVerifiedAt: null,
          resultVerifiedBy: null,
          remarks: note,
        },
      });
      return restored;
    });
  }

  restoreTeacher(id: number, madrasaId: number) {
    return prisma.teacher.updateMany({
      where: { id, madrasaId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
  }

  // Restored exams/divisions/classes/books come back as the LAST serial of
  // their list (like a newly added one) - their old sortOrder may now clash
  // with, or sit in the middle of, the list the madrasa re-arranged meanwhile.
  async restoreExam(id: number, madrasaId: number) {
    const last = await prisma.exam.findFirst({
      where: { madrasaId, deletedAt: null },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    return prisma.exam.updateMany({
      where: { id, madrasaId, deletedAt: { not: null } },
      data: { deletedAt: null, sortOrder: (last?.sortOrder ?? -1) + 1 },
    });
  }

  async restoreDivision(id: number, madrasaId: number) {
    const last = await prisma.madrasaDivision.findFirst({
      where: { madrasaId, isActive: 1 },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    return prisma.madrasaDivision.updateMany({
      where: { id, madrasaId, deletedAt: { not: null } },
      data: { deletedAt: null, isActive: 1, sortOrder: (last?.sortOrder ?? -1) + 1 },
    });
  }

  async restoreClass(id: number, madrasaId: number) {
    const row = await prisma.madrasaClass.findFirst({
      where: { id, madrasaId },
      select: { class: { select: { divisionId: true } } },
    });
    const last = await prisma.madrasaClass.findFirst({
      where: { madrasaId, isActive: 1, class: { divisionId: row?.class.divisionId ?? null } },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    return prisma.madrasaClass.updateMany({
      where: { id, madrasaId, deletedAt: { not: null } },
      data: { deletedAt: null, isActive: 1, sortOrder: (last?.sortOrder ?? -1) + 1 },
    });
  }

  async restoreBook(id: number, madrasaId: number) {
    const row = await prisma.madrasaBook.findFirst({
      where: { id, madrasaId },
      select: { book: { select: { classId: true } } },
    });
    const last = row
      ? await prisma.madrasaBook.findFirst({
          where: { madrasaId, isActive: 1, book: { classId: row.book.classId } },
          orderBy: { sortOrder: "desc" },
          select: { sortOrder: true },
        })
      : null;
    return prisma.madrasaBook.updateMany({
      where: { id, madrasaId, deletedAt: { not: null } },
      data: { deletedAt: null, isActive: 1, sortOrder: (last?.sortOrder ?? -1) + 1 },
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
