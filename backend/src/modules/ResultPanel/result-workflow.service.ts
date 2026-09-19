import { Prisma } from "@prisma/client";
import { BadRequestError, ConflictError, NotFoundError } from "../../shared/errors";
import { logActivity } from "../../shared/utils/activity.util";
import { hasExamDepartmentAuthority, hasFullResultAuthority } from "../../shared/utils/rbac.util";
import { canCandidateParticipate } from "../exam-candidate/exam-candidate.policy";
import { resultWorkflowRepository, ResultWorkflowRepository } from "./result-workflow.repository";
import { resultPanelRepository } from "./result-panel.repository";
import { MadrasaGradingConfig } from "./result-grading-config";

const toBanglaDigits = (value: string | number) =>
  String(value).replace(/\d/g, (digit) => "০১২৩৪৫৬৭৮৯"[Number(digit)]);

/**
 * Subject-level submission/verification queue (MarkSubmission) and the
 * result-level verify/approve/lock progression on top of it. Marks-entry
 * itself, and the grading engine, stay in result-panel.service.ts - this
 * service only owns the status machine layered on top.
 */
export class ResultWorkflowService {
  constructor(private readonly repository: ResultWorkflowRepository = resultWorkflowRepository) {}

  private async assertMaster(madrasaId: number, resultMasterId: number) {
    if (!resultMasterId) throw new BadRequestError("result_master_id is required");
    const master = await this.repository.findResultMaster(resultMasterId, madrasaId);
    if (!master) throw new NotFoundError("Result session not found");
    return master;
  }

  private async assertActiveBook(madrasaId: number, classId: number, bookId: number) {
    const subjects = await resultPanelRepository.findActiveSubjectsForClass(madrasaId, classId);
    const active = subjects.some((s) => s.book && s.book.id === bookId);
    if (!active) throw new BadRequestError("এই বিষয়টি এই শ্রেণির জন্য সক্রিয় নয়।");
  }

  /** Re-derives ResultMaster.status from the current MarkSubmission states
   * after a submit or verify event - shared by both since a verify can also
   * complete the "every subject submitted" milestone (e.g. the last
   * remaining subject was submitted and verified in the same request
   * sequence). Only ever advances forward; rejection moves the status
   * backward separately (see rejectBook). */
  private async recomputeAfterSubmissionEvent(
    madrasaId: number,
    resultMasterId: number,
    classId: number,
    actorId: number,
  ) {
    const [subjects, submissions] = await Promise.all([
      resultPanelRepository.findActiveSubjectsForClass(madrasaId, classId),
      this.repository.findMarkSubmissions(resultMasterId),
    ]);

    const bookIds = subjects.filter((s) => s.book).map((s) => s.book!.id);
    if (!bookIds.length) return;

    const statusByBook = new Map(submissions.map((s) => [s.bookId, s.status]));
    const allVerified = bookIds.every((id) => statusByBook.get(id) === "VERIFIED");
    const allSubmittedOrVerified = bookIds.every((id) => {
      const st = statusByBook.get(id);
      return st === "SUBMITTED" || st === "VERIFIED";
    });

    // Best-effort: only advances while the session is still in the
    // marks-submission phase, so a race against a later stage (e.g. this
    // recompute firing just as the result gets published elsewhere) can't
    // regress an already-advanced status. Not throwing on a missed guard
    // here - unlike the user-facing transitions below - since this is a
    // background side-effect of submit/verify, not the primary action the
    // caller asked for.
    const inSubmissionPhase = ["DRAFT", "MARKS_SUBMITTED", "MARKS_VERIFIED"];
    if (allVerified) {
      await this.repository.updateResultMasterStatus(resultMasterId, madrasaId, inSubmissionPhase, {
        status: "MARKS_VERIFIED",
        marksVerifiedAt: new Date(),
        marksVerifiedBy: actorId,
      });
    } else if (allSubmittedOrVerified) {
      await this.repository.updateResultMasterStatus(resultMasterId, madrasaId, inSubmissionPhase, {
        status: "MARKS_SUBMITTED",
        submittedAt: new Date(),
        submittedBy: actorId,
      });
    }
  }

  /** Public entry to the same status re-derivation submit/verify run, for
   * callers (ResultPanelService.processResult) that find a session whose
   * status lags behind its subjects' actual submission states. */
  async syncStatusFromSubmissions(madrasaId: number, resultMasterId: number, actorId: number) {
    const master = await this.assertMaster(madrasaId, resultMasterId);
    await this.recomputeAfterSubmissionEvent(madrasaId, resultMasterId, master.classId, actorId);
  }

  async getSubmissions(madrasaId: number, resultMasterId: number) {
    const master = await this.assertMaster(madrasaId, resultMasterId);

    const [subjects, submissions] = await Promise.all([
      resultPanelRepository.findActiveSubjectsForClass(madrasaId, master.classId),
      this.repository.findMarkSubmissions(resultMasterId),
    ]);

    const byBook = new Map(submissions.map((s) => [s.bookId, s]));

    return subjects
      .filter((s) => s.book)
      .map((s) => {
        const book = s.book!;
        const sub = byBook.get(book.id);
        return {
          book_id: book.id,
          book_name: book.nameBn || book.name || `বিষয় ${book.id}`,
          status: sub?.status || "DRAFT",
          submitted_by: sub?.submittedBy ?? null,
          submitted_at: sub?.submittedAt ?? null,
          verified_by: sub?.verifiedBy ?? null,
          verified_at: sub?.verifiedAt ?? null,
          comment: sub?.comment ?? null,
        };
      });
  }

  async submitBook(madrasaId: number, userId: number, resultMasterId: number, bookId: number) {
    if (!bookId) throw new BadRequestError("book_id is required");
    const master = await this.assertMaster(madrasaId, resultMasterId);
    await this.assertActiveBook(madrasaId, master.classId, bookId);

    const existing = await this.repository.findMarkSubmission(resultMasterId, bookId);
    if (existing && (existing.status === "SUBMITTED" || existing.status === "VERIFIED")) {
      throw new ConflictError("এই বিষয়ের নম্বর ইতিমধ্যে জমা দেওয়া হয়েছে।");
    }

    const missing = await this.repository.findStudentsMissingMarkForBook(
      madrasaId,
      master.examId,
      master.classId,
      resultMasterId,
      bookId,
    );
    if (missing.length) {
      const examples = missing
        .slice(0, 3)
        .map(
          (s) =>
            `${s.nameBn || `শিক্ষার্থী ${s.id}`}${s.roll ? ` (রোল ${toBanglaDigits(s.roll)})` : ""}`,
        )
        .join(", ");
      const more =
        missing.length > 3 ? ` সহ আরও ${toBanglaDigits(missing.length - 3)} জন` : "";
      throw new BadRequestError(
        `${toBanglaDigits(missing.length)} জন শিক্ষার্থীর এই বিষয়ের নম্বর এখনও দেওয়া হয়নি — ${examples}${more}। জমা দেওয়ার আগে সবার নম্বর (বা অনুপস্থিত/অব্যাহতি/স্থগিত চিহ্ন) দিন।`,
      );
    }

    await this.repository.upsertMarkSubmissionSubmitted(madrasaId, resultMasterId, bookId, userId);
    await this.recomputeAfterSubmissionEvent(madrasaId, resultMasterId, master.classId, userId);

    await logActivity({
      madrasa_id: madrasaId,
      user_id: userId,
      action: "SUBMIT",
      entity: "results/submissions",
      entity_id: resultMasterId,
      details: JSON.stringify({ book_id: bookId }),
    });

    return { message: "নম্বর জমা দেওয়া হয়েছে", result_master_id: resultMasterId, book_id: bookId };
  }

  async verifyBook(
    madrasaId: number,
    userId: number,
    resultMasterId: number,
    bookId: number,
    comment?: string,
  ) {
    if (!bookId) throw new BadRequestError("book_id is required");
    const master = await this.assertMaster(madrasaId, resultMasterId);

    const submission = await this.repository.findMarkSubmission(resultMasterId, bookId);
    if (!submission || submission.status !== "SUBMITTED") {
      throw new ConflictError("এই বিষয়ের নম্বর এখনও জমা দেওয়া হয়নি — যাচাই করার আগে জমা দিতে হবে।");
    }

    if (submission.submittedBy === userId && !(await hasExamDepartmentAuthority(userId))) {
      throw new ConflictError(
        "নিজের জমা করা নম্বর নিজে যাচাই করা যাবে না — ভিন্ন ব্যবহারকারীর মাধ্যমে যাচাই করাতে হবে।",
      );
    }

    await this.repository.markSubmissionVerified(resultMasterId, bookId, userId, comment?.trim() || null);
    await this.recomputeAfterSubmissionEvent(madrasaId, resultMasterId, master.classId, userId);

    await logActivity({
      madrasa_id: madrasaId,
      user_id: userId,
      action: "VERIFY",
      entity: "results/submissions",
      entity_id: resultMasterId,
      details: JSON.stringify({ book_id: bookId, comment: comment?.trim() || null }),
    });

    return { message: "নম্বর যাচাই সম্পন্ন হয়েছে", result_master_id: resultMasterId, book_id: bookId };
  }

  async rejectBook(
    madrasaId: number,
    userId: number,
    resultMasterId: number,
    bookId: number,
    reason: string,
  ) {
    if (!bookId) throw new BadRequestError("book_id is required");
    if (!reason || !reason.trim()) {
      throw new BadRequestError("প্রত্যাখ্যানের কারণ উল্লেখ করা আবশ্যক।");
    }

    const master = await this.assertMaster(madrasaId, resultMasterId);

    const submission = await this.repository.findMarkSubmission(resultMasterId, bookId);
    if (!submission || (submission.status !== "SUBMITTED" && submission.status !== "VERIFIED")) {
      throw new ConflictError("এই বিষয়ের নম্বর জমা/যাচাই অবস্থায় নেই — প্রত্যাখ্যান করা যাবে না।");
    }

    const trimmedReason = reason.trim();
    await this.repository.markSubmissionRejected(resultMasterId, bookId, trimmedReason);

    const data: Prisma.ResultMasterUpdateInput = {
      rejectedAt: new Date(),
      rejectedBy: userId,
      rejectedReason: trimmedReason,
    };
    if (master.status === "MARKS_SUBMITTED" || master.status === "MARKS_VERIFIED") {
      data.status = "DRAFT";
    }
    const ok = await this.repository.updateResultMasterStatus(resultMasterId, madrasaId, [master.status], data);
    if (!ok) {
      throw new ConflictError(
        "অন্য কেউ এরই মধ্যে এই ফলাফলের অবস্থা পরিবর্তন করেছে — পাতা রিফ্রেশ করে আবার চেষ্টা করুন।",
      );
    }

    await logActivity({
      madrasa_id: madrasaId,
      user_id: userId,
      action: "REJECT",
      entity: "results/submissions",
      entity_id: resultMasterId,
      details: JSON.stringify({ book_id: bookId, reason: trimmedReason }),
    });

    return { message: "নম্বর প্রত্যাখ্যান করা হয়েছে", result_master_id: resultMasterId, book_id: bookId };
  }

  /** Result-level verification pass - a read-mostly sanity re-check of the
   * grading engine's own output (never recomputes grading itself), plus a
   * fail-open cross-check against ExamCandidate holds. The missing-marks
   * check itself is scoped to active students who are also participating
   * ExamCandidates when that roster is non-empty for this exam+class,
   * falling back to every active student for exams that predate candidate
   * registration (see the candidateRoster/requiredStudents computation
   * below). Mutates status only when every check passes. */
  async verifyResult(madrasaId: number, userId: number, resultMasterId: number, remarks?: string) {
    const master = await this.assertMaster(madrasaId, resultMasterId);

    if (master.status !== "PROCESSING" && master.status !== "RESULT_VERIFIED") {
      throw new ConflictError(
        "ফলাফল প্রসেস (PROCESSING) অবস্থায় থাকলেই কেবল ফলাফল যাচাই করা যায়।",
      );
    }

    const [activeStudents, summaries, withheldRows, failMark, candidateRows, candidateRoster] =
      await Promise.all([
        resultPanelRepository.findActiveStudentsInClass(madrasaId, master.classId),
        this.repository.findResultSummaryRows(resultMasterId),
        resultPanelRepository.findWithheldStudentIds(
          madrasaId,
          master.examId,
          master.classId,
          resultMasterId,
        ),
        // The class's division-resolved fail mark (division override, else
        // the madrasa-wide setting) - the same value the grading engine used.
        new MadrasaGradingConfig(resultPanelRepository, madrasaId).failMarkForClass(master.classId),
        this.repository.findExamCandidatesReadOnly(madrasaId, master.examId),
        resultPanelRepository.findParticipatingCandidatesInClass(
          madrasaId,
          master.examId,
          master.classId,
        ),
      ]);

    const withheldSet = new Set(withheldRows.map((r) => Number(r.studentId)));
    const summaryByStudent = new Map(summaries.map((s) => [Number(s.studentId), s]));

    // Missing-marks scoping: when this exam+class has a non-empty
    // ExamCandidate roster, only students who are BOTH active AND actually
    // participating candidates are required to have a result row - an
    // active-but-non-candidate student (e.g. an unpaid fee-exam student) is
    // legitimately expected to have no marks at all, so checking them here
    // would falsely flag "missing marks". Fail-open: an exam predating
    // candidate registration has zero ExamCandidate rows for this
    // exam+class, so keep today's exact behavior of checking every active
    // student.
    const candidateIdSet = new Set(candidateRoster.map((c) => c.id));
    const requiredStudents = candidateIdSet.size
      ? activeStudents.filter((s) => candidateIdSet.has(s.id))
      : activeStudents;

    const issues: string[] = [];
    let missingMarks = 0;
    let invalidMarks = 0;
    let missingGrades = 0;
    let passCount = 0;
    let failCount = 0;
    let absentCount = 0;

    for (const student of requiredStudents) {
      if (withheldSet.has(student.id)) continue;

      const row = summaryByStudent.get(student.id);
      const label = student.nameBn || `শিক্ষার্থী ${student.id}`;

      if (!row) {
        missingMarks += 1;
        issues.push(`${label} এর ফলাফল প্রসেস করা হয়নি (কোনো ফলাফল সারাংশ নেই)।`);
        continue;
      }

      if (row.status === null) {
        missingGrades += 1;
        issues.push(`${label} এর ফলাফলের অবস্থা (status) নির্ধারিত হয়নি।`);
      }

      const total = Number(row.total);
      const average = Number(row.average);
      if (!Number.isFinite(total) || total < 0 || !Number.isFinite(average) || average < 0) {
        invalidMarks += 1;
        issues.push(`${label} এর মোট/গড় নম্বর সঠিক নয়।`);
      }

      if (row.status === "PASS") {
        passCount += 1;
        if (average < failMark) {
          invalidMarks += 1;
          issues.push(`${label} কে পাস দেখানো হয়েছে কিন্তু গড় নম্বর পাস মার্কের নিচে।`);
        }
      } else if (row.status === "FAIL") {
        failCount += 1;
        if (average >= failMark) {
          invalidMarks += 1;
          issues.push(`${label} কে ফেল দেখানো হয়েছে কিন্তু গড় নম্বর পাস মার্কের সমান বা বেশি।`);
        }
      } else if (row.status === "ABSENT") {
        absentCount += 1;
      }
    }

    // Fail-open: an exam predating candidate registration has zero
    // ExamCandidate rows, so skip this cross-check entirely rather than
    // treating "no candidates registered" as an error.
    if (candidateRows.length) {
      // Uses the canonical participation rule (exam-candidate.policy.ts)
      // instead of only checking candidate.status - status alone missed
      // the far more common case of a REGISTERED candidate the automatic
      // eligibility engine had already flagged eligibilityStatus =
      // INELIGIBLE (that flow never touches `status`, see exam-candidate.
      // service.ts's checkEligibility/bulkCheckEligibility), so those
      // candidates previously sailed through this check unflagged.
      const blockedStudentIds = new Set(
        candidateRows
          .filter((c) => !canCandidateParticipate(c.status, c.eligibilityStatus))
          .map((c) => Number(c.studentId)),
      );
      for (const studentId of blockedStudentIds) {
        const row = summaryByStudent.get(studentId);
        if (row && (row.status === "PASS" || row.status === "FAIL")) {
          issues.push(
            `শিক্ষার্থী আইডি ${studentId} পরীক্ষায় অংশগ্রহণের অনুমতি না থাকা সত্ত্বেও (WITHHELD/INELIGIBLE/CANCELLED) স্বাভাবিক ফলাফল (${row.status}) দেখাচ্ছে।`,
          );
        }
      }
    }

    const valid = issues.length === 0;

    if (valid) {
      const ok = await this.repository.updateResultMasterStatus(
        resultMasterId,
        madrasaId,
        ["PROCESSING", "RESULT_VERIFIED"],
        {
          status: "RESULT_VERIFIED",
          resultVerifiedAt: new Date(),
          resultVerifiedBy: userId,
          ...(remarks !== undefined ? { remarks: remarks || null } : {}),
        },
      );
      if (!ok) {
        throw new ConflictError(
          "অন্য কেউ এরই মধ্যে এই ফলাফলের অবস্থা পরিবর্তন করেছে — পাতা রিফ্রেশ করে আবার চেষ্টা করুন।",
        );
      }

      await logActivity({
        madrasa_id: madrasaId,
        user_id: userId,
        action: "VERIFY_RESULT",
        entity: "results/verify-result",
        entity_id: resultMasterId,
        details: JSON.stringify({ passCount, failCount, absentCount, withheldCount: withheldSet.size }),
      });
    }

    return {
      valid,
      issues,
      stats: {
        totalStudents: requiredStudents.length,
        missingMarks,
        invalidMarks,
        missingGrades,
        passCount,
        failCount,
        absentCount,
        withheldCount: withheldSet.size,
      },
    };
  }

  async decideApproval(
    madrasaId: number,
    userId: number,
    resultMasterId: number,
    approve: boolean,
    remarks?: string,
  ) {
    const master = await this.assertMaster(madrasaId, resultMasterId);

    if (master.status !== "RESULT_VERIFIED") {
      throw new ConflictError(
        "ফলাফল যাচাই (RESULT_VERIFIED) সম্পন্ন না হলে অনুমোদন/প্রত্যাখ্যান করা যাবে না।",
      );
    }

    // Same-person verify+approve is only blocked for a genuine
    // separate-checker setup. An actor holding both result.verify and
    // result.approve (the single তালিমাত-office case, or Muhtamim/Super
    // Admin) has no second person to hand this off to, so they're let
    // through - exactly like hasFullMarksAuthority does one level down at
    // the subject submit/verify stage. A role limited to only
    // result.verify (a genuine separate checker) still hits this gate.
    if (
      master.resultVerifiedBy != null &&
      master.resultVerifiedBy === userId &&
      !(await hasFullResultAuthority(userId))
    ) {
      throw new ConflictError(
        "নিজে যাচাই করা ফলাফল নিজে অনুমোদন/প্রত্যাখ্যান করা যাবে না — ভিন্ন ব্যবহারকারীর অনুমোদন প্রয়োজন।",
      );
    }

    if (approve) {
      const ok = await this.repository.updateResultMasterStatus(
        resultMasterId,
        madrasaId,
        ["RESULT_VERIFIED"],
        {
          status: "APPROVED",
          approvedAt: new Date(),
          approvedBy: userId,
          ...(remarks !== undefined ? { remarks: remarks || null } : {}),
        },
      );
      if (!ok) {
        throw new ConflictError(
          "অন্য কেউ এরই মধ্যে এই ফলাফলের অবস্থা পরিবর্তন করেছে — পাতা রিফ্রেশ করে আবার চেষ্টা করুন।",
        );
      }

      await logActivity({
        madrasa_id: madrasaId,
        user_id: userId,
        action: "APPROVE",
        entity: "results/approve",
        entity_id: resultMasterId,
        details: JSON.stringify({ remarks: remarks || null }),
      });

      return { message: "ফলাফল অনুমোদিত হয়েছে", result_master_id: resultMasterId };
    }

    if (!remarks || !remarks.trim()) {
      throw new BadRequestError("প্রত্যাখ্যানের কারণ (remarks) উল্লেখ করা আবশ্যক।");
    }

    const rejectOk = await this.repository.updateResultMasterStatus(
      resultMasterId,
      madrasaId,
      ["RESULT_VERIFIED"],
      {
        status: "PROCESSING",
        rejectedAt: new Date(),
        rejectedBy: userId,
        rejectedReason: remarks.trim(),
      },
    );
    if (!rejectOk) {
      throw new ConflictError(
        "অন্য কেউ এরই মধ্যে এই ফলাফলের অবস্থা পরিবর্তন করেছে — পাতা রিফ্রেশ করে আবার চেষ্টা করুন।",
      );
    }

    await logActivity({
      madrasa_id: madrasaId,
      user_id: userId,
      action: "REJECT",
      entity: "results/approve",
      entity_id: resultMasterId,
      details: JSON.stringify({ reason: remarks.trim() }),
    });

    return { message: "ফলাফল প্রত্যাখ্যান করা হয়েছে", result_master_id: resultMasterId };
  }

  async lock(madrasaId: number, userId: number, resultMasterId: number) {
    const master = await this.assertMaster(madrasaId, resultMasterId);

    if (master.status !== "PUBLISHED") {
      throw new ConflictError("ফলাফল প্রকাশিত (PUBLISHED) না হলে লক করা যাবে না।");
    }

    const ok = await this.repository.updateResultMasterStatus(resultMasterId, madrasaId, ["PUBLISHED"], {
      status: "LOCKED",
      lockedAt: new Date(),
      lockedBy: userId,
    });
    if (!ok) {
      throw new ConflictError(
        "অন্য কেউ এরই মধ্যে এই ফলাফলের অবস্থা পরিবর্তন করেছে — পাতা রিফ্রেশ করে আবার চেষ্টা করুন।",
      );
    }

    await logActivity({
      madrasa_id: madrasaId,
      user_id: userId,
      action: "LOCK",
      entity: "results/lock",
      entity_id: resultMasterId,
    });

    return { message: "ফলাফল লক করা হয়েছে", result_master_id: resultMasterId };
  }
}

export const resultWorkflowService = new ResultWorkflowService();
