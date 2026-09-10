import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";

/**
 * Data access for the subject-level submission/verification queue and the
 * result-level verify/approve/publish/lock progression - everything that
 * reads or writes MarkSubmission plus the workflow columns on ResultMaster.
 * Marks-entry itself (Mark rows, the grading engine) stays owned by
 * result-panel.repository.ts / result-panel.service.ts; this module only
 * orchestrates the status machine layered on top of it.
 */
export class ResultWorkflowRepository {
  findResultMaster(resultMasterId: number, madrasaId: number) {
    return prisma.resultMaster.findFirst({
      where: { id: resultMasterId, madrasaId, deletedAt: null },
    });
  }

  findMarkSubmissions(resultMasterId: number) {
    return prisma.markSubmission.findMany({ where: { resultMasterId } });
  }

  findMarkSubmission(resultMasterId: number, bookId: number) {
    return prisma.markSubmission.findUnique({
      where: { resultMasterId_bookId: { resultMasterId, bookId } },
    });
  }

  upsertMarkSubmissionSubmitted(
    madrasaId: number,
    resultMasterId: number,
    bookId: number,
    submittedBy: number,
  ) {
    const now = new Date();
    return prisma.markSubmission.upsert({
      where: { resultMasterId_bookId: { resultMasterId, bookId } },
      update: { status: "SUBMITTED", submittedBy, submittedAt: now },
      create: {
        madrasaId,
        resultMasterId,
        bookId,
        status: "SUBMITTED",
        submittedBy,
        submittedAt: now,
      },
    });
  }

  markSubmissionVerified(
    resultMasterId: number,
    bookId: number,
    verifiedBy: number,
    comment: string | null,
  ) {
    return prisma.markSubmission.update({
      where: { resultMasterId_bookId: { resultMasterId, bookId } },
      data: { status: "VERIFIED", verifiedBy, verifiedAt: new Date(), comment },
    });
  }

  /** Rejection reverts a subject's submission back to DRAFT so the owning
   * teacher can re-edit/resubmit — the rejection reason is kept on the
   * ResultMaster's rejectedAt/By/Reason columns (see
   * ResultWorkflowService.rejectBook), not on MarkSubmission itself, so
   * `comment` here just carries the reviewer's note forward for context. */
  markSubmissionRejected(resultMasterId: number, bookId: number, comment: string) {
    return prisma.markSubmission.update({
      where: { resultMasterId_bookId: { resultMasterId, bookId } },
      data: { status: "DRAFT", comment },
    });
  }

  /** Active-class students who don't yet have ANY Mark row for one specific
   * book (present/absent/exempted/withheld all count as "entered" — only a
   * missing row is incomplete). Mirrors
   * ResultPanelService.getMarkCompleteness but scoped to a single bookId
   * instead of every active subject, for the per-book submit gate. */
  async findStudentsMissingMarkForBook(
    madrasaId: number,
    classId: number,
    resultMasterId: number,
    bookId: number,
  ) {
    const [students, entered] = await Promise.all([
      prisma.student.findMany({
        where: { madrasaId, classId, deletedAt: null, isActive: 1 },
        select: { id: true, nameBn: true, roll: true },
      }),
      prisma.mark.findMany({
        where: { resultMasterId, bookId },
        select: { studentId: true },
      }),
    ]);

    const enteredIds = new Set(entered.map((e) => e.studentId));
    return students.filter((s) => !enteredIds.has(s.id));
  }

  updateResultMasterStatus(resultMasterId: number, data: Prisma.ResultMasterUpdateInput) {
    return prisma.resultMaster.update({ where: { id: resultMasterId }, data });
  }

  findResultSummaryRows(resultMasterId: number) {
    return prisma.resultSummary.findMany({
      where: { resultMasterId },
      select: {
        studentId: true,
        total: true,
        average: true,
        status: true,
        generalGrade: true,
        madrasaGrade: true,
      },
    });
  }

  /** READ-ONLY cross-check against the ExamCandidate model (owned by the
   * concurrent Exam Core/Operations work) - never write to this table. May
   * legitimately return zero rows for exams predating candidate
   * registration; callers must fail open in that case rather than treating
   * "no candidates registered" as an error. */
  findExamCandidatesReadOnly(madrasaId: number, examId: number) {
    return prisma.examCandidate.findMany({
      where: { madrasaId, examId },
      select: { studentId: true, status: true },
    });
  }
}

export const resultWorkflowRepository = new ResultWorkflowRepository();
