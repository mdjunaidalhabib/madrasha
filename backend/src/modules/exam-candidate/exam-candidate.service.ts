import { ExamCandidateStatus } from "@prisma/client";
import { ApiError, BadRequestError, NotFoundError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import { examCandidateRepository, ExamCandidateRepository } from "./exam-candidate.repository";
import { eligibilityService, EligibilityService } from "./eligibility.service";
import { EXAM_CANDIDATE_STATUSES } from "./exam-candidate.constants";
import {
  BulkEligibilityCheckRequestDto,
  BulkUpdateStatusRequestDto,
  EligibilityCheckRequestDto,
  EligibleStudentsQueryDto,
  ListExamCandidatesQueryDto,
  UpdateCandidateStatusRequestDto,
} from "./exam-candidate.dto";

const friendlyFailure = (logTag: string, err: unknown, friendlyMessage: string): never => {
  logger.error(logTag, err);
  throw new ApiError(friendlyMessage, 500);
};

// Caps every bulk exam-candidate endpoint's batch size - these process
// sequentially with per-item DB round trips (no native Prisma bulk-upsert
// for this shape), so an unbounded array is an easy request-timeout/DoS
// vector. 200 comfortably covers a full class list with room to spare.
const MAX_BULK_ITEMS = 200;

const assertBulkSize = (count: number, label: string) => {
  if (count > MAX_BULK_ITEMS) {
    throw new BadRequestError(`একসাথে সর্বোচ্চ ${MAX_BULK_ITEMS}টি ${label} প্রক্রিয়া করা যায়।`);
  }
};

const toId = (value: unknown, label: string): number => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new BadRequestError(`${label} is required`);
  return id;
};

export class ExamCandidateService {
  constructor(
    private readonly repository: ExamCandidateRepository = examCandidateRepository,
    private readonly eligibility: EligibilityService = eligibilityService,
  ) {}

  /* ================= LIST / DETAIL ================= */

  async list(madrasaId: number, query: ListExamCandidatesQueryDto) {
    const examId = toId(query.exam_id, "exam_id");
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));

    try {
      const { rows, total } = await this.repository.listCandidates(
        madrasaId,
        {
          examId,
          classId: query.class_id ? Number(query.class_id) : undefined,
          divisionId: query.division_id ? Number(query.division_id) : undefined,
          status: query.status as ExamCandidateStatus | undefined,
          eligibilityStatus: query.eligibility_status as any,
          search: query.search?.trim() || undefined,
        },
        { skip: (page - 1) * limit, take: limit },
      );

      return { rows, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
    } catch (err) {
      return friendlyFailure("examCandidate.list error:", err, "Failed to load exam candidates");
    }
  }

  async getById(madrasaId: number, id: number) {
    const candidate = await this.repository.findCandidateById(madrasaId, id);
    if (!candidate) throw new NotFoundError("Exam candidate not found");
    return candidate;
  }

  /** Active, admitted students in a class/division not yet registered for
   * this exam, each annotated with a live (unsaved) eligibility preview -
   * powers the "register students" screen. */
  async eligibleStudents(madrasaId: number, query: EligibleStudentsQueryDto) {
    const examId = toId(query.exam_id, "exam_id");
    const exam = await this.repository.findExam(madrasaId, examId);
    if (!exam) throw new NotFoundError("Exam not found");

    try {
      const students = await this.repository.findEligibleStudentPool(madrasaId, {
        examId,
        classId: query.class_id ? Number(query.class_id) : undefined,
        divisionId: query.division_id ? Number(query.division_id) : undefined,
        search: query.search?.trim() || undefined,
      });

      const results = await Promise.all(
        students.map(async (student) => {
          const evaluation = await this.eligibility.evaluate(madrasaId, {
            examId,
            studentId: student.id,
            isRegistered: false,
            requireRegistration: false,
          });
          return {
            student_id: student.id,
            name_bn: student.nameBn,
            name_en: student.nameEn,
            roll: student.roll,
            class_id: student.classId,
            division_id: student.divisionId,
            eligible: evaluation.eligible,
            reasons: evaluation.reasons,
          };
        }),
      );

      return results;
    } catch (err) {
      return friendlyFailure("examCandidate.eligibleStudents error:", err, "Failed to load eligible students");
    }
  }

  /* ================= REGISTRATION (automatic only - see class doc) ================= */

  /**
   * Core registration loop shared by both automatic triggers -
   * `autoRegisterForRoutine` (free exam, whole class/division) and
   * `autoRegisterOnInvoicePaid` (fee-linked exam, one student on full
   * payment). Manual registration was removed entirely: candidates are now
   * only ever created by one of those two triggers, both of which funnel
   * through here.
   *
   * Registration numbers are reserved in one batch query, then all rows are
   * inserted in one `createMany` (relying on `skipDuplicates` +
   * `uniq_exam_candidate_exam_student` to make this safe under a race with
   * another trigger), inside a single transaction. The eligibility
   * evaluation afterwards stays per-row - unchanged from the old
   * register/bulkRegister behavior - since it's a read-heavy check
   * (fees/attendance) that doesn't benefit from batching.
   */
  private async registerBatch(
    madrasaId: number,
    examId: number,
    students: Array<{ id: number; sessionId: number; classId: number; divisionId: number | null }>,
    createdBy?: number,
  ): Promise<{ created: number }> {
    // ExamCandidate.divisionId is a required column - Student.divisionId is
    // likewise non-null in the schema, so this is defensive only (guards
    // the `number | null` shape this method's callers are typed with,
    // e.g. a payment-driven trigger reading a plain Student row) rather
    // than something expected to actually trigger.
    const valid = students.filter((s): s is typeof s & { divisionId: number } => {
      if (s.divisionId != null) return true;
      logger.error(`examCandidate.registerBatch: skipping student ${s.id} - no divisionId (exam ${examId})`);
      return false;
    });
    if (!valid.length) return { created: 0 };

    const registrationNos = await this.repository.runTransaction(async (tx) => {
      const numbers = await this.repository.nextRegistrationNoBatch(tx, madrasaId, examId, valid.length);
      await this.repository.createCandidatesOnTx(
        tx,
        valid.map((student, i) => ({
          madrasaId,
          examId,
          studentId: student.id,
          sessionId: student.sessionId,
          classId: student.classId,
          divisionId: student.divisionId,
          registrationNo: numbers[i],
          createdBy: createdBy ?? null,
        })),
      );
      return numbers;
    });

    for (const student of valid) {
      try {
        const evaluation = await this.eligibility.evaluate(madrasaId, {
          examId,
          studentId: student.id,
          isRegistered: true,
          requireRegistration: true,
        });
        const candidate = await this.repository.findCandidateByExamStudent(madrasaId, examId, student.id);
        if (candidate) {
          await this.repository.updateEligibility(candidate.id, {
            eligibilityStatus: this.eligibility.eligibilityStatusFrom(evaluation),
            eligibilityReasons: JSON.stringify(evaluation.reasons),
          });
        }
      } catch (err) {
        // One student's eligibility check failing must never roll back or
        // block the rest of the batch's registrations - they're already
        // committed above.
        logger.error("examCandidate.registerBatch eligibility evaluation failed:", err);
      }
    }

    return { created: registrationNos.length };
  }

  /**
   * Trigger (A): free exam (no linked fee structure) - every active
   * student in the routine's class(+division) auto-becomes a candidate
   * whenever an ExamRoutine is created/updated for that class. Called as a
   * side effect from routine.service.ts (via exam-candidate.hooks.ts) -
   * never throws, since a registration hiccup must never block routine
   * creation itself.
   */
  async autoRegisterForRoutine(
    madrasaId: number,
    examId: number,
    classId: number,
    divisionId: number | null,
    createdBy?: number,
  ): Promise<void> {
    try {
      if (await this.repository.examHasFeeLink(madrasaId, examId)) return;

      const exam = await this.repository.findExam(madrasaId, examId);
      if (!exam) {
        logger.error(`examCandidate.autoRegisterForRoutine: exam ${examId} not found (madrasa ${madrasaId})`);
        return;
      }

      const pool = await this.repository.findEligibleStudentPool(madrasaId, {
        examId,
        classId,
        // findEligibleStudentPool's filter takes `number | undefined` (no
        // division filter = whole class); the routine's own divisionId is
        // `number | null` ("no specific division" recorded as null).
        divisionId: divisionId ?? undefined,
      });
      if (!pool.length) return;

      await this.registerBatch(
        madrasaId,
        examId,
        pool.map((s) => ({ id: s.id, sessionId: s.sessionId, classId: s.classId, divisionId: s.divisionId })),
        createdBy,
      );
    } catch (err) {
      logger.error("examCandidate.autoRegisterForRoutine failed:", err);
    }
  }

  /**
   * Trigger (B): fee-linked exam - a student auto-becomes a candidate only
   * once their invoice for that exam's fee structure reaches full PAID
   * status (never on invoice creation, PARTIALLY_PAID, or a waiver). Called
   * as a side effect from fee.service.ts's recordPayment() (via
   * exam-candidate.hooks.ts) - never throws, a registration hiccup must
   * never surface as a payment failure.
   */
  async autoRegisterOnInvoicePaid(
    madrasaId: number,
    examId: number,
    student: { id: number; sessionId: number; classId: number; divisionId: number | null },
  ): Promise<void> {
    try {
      const existing = await this.repository.findCandidateByExamStudent(madrasaId, examId, student.id);
      if (existing) return;

      await this.registerBatch(madrasaId, examId, [student]);
    } catch (err) {
      logger.error("examCandidate.autoRegisterOnInvoicePaid failed:", err);
    }
  }

  /* ================= ELIGIBILITY ================= */

  async checkEligibility(madrasaId: number, dto: EligibilityCheckRequestDto) {
    let examId: number;
    let studentId: number;
    let candidateId: number | undefined;

    if (dto.candidate_id) {
      candidateId = toId(dto.candidate_id, "candidate_id");
      const candidate = await this.repository.findCandidateById(madrasaId, candidateId);
      if (!candidate) throw new NotFoundError("Exam candidate not found");
      examId = candidate.examId;
      studentId = candidate.studentId;
    } else {
      examId = toId(dto.exam_id, "exam_id");
      studentId = toId(dto.student_id, "student_id");
      const candidate = await this.repository.findCandidateByExamStudent(madrasaId, examId, studentId);
      candidateId = candidate?.id;
    }

    try {
      const evaluation = await this.eligibility.evaluate(madrasaId, {
        examId,
        studentId,
        isRegistered: Boolean(candidateId),
        requireRegistration: Boolean(candidateId),
      });

      if (candidateId) {
        await this.repository.updateEligibility(candidateId, {
          eligibilityStatus: this.eligibility.eligibilityStatusFrom(evaluation),
          eligibilityReasons: JSON.stringify(evaluation.reasons),
        });
      }

      return { candidate_id: candidateId ?? null, ...evaluation };
    } catch (err) {
      return friendlyFailure("examCandidate.checkEligibility error:", err, "Failed to check eligibility");
    }
  }

  async bulkCheckEligibility(madrasaId: number, dto: BulkEligibilityCheckRequestDto) {
    const examId = toId(dto.exam_id, "exam_id");
    const exam = await this.repository.findExam(madrasaId, examId);
    if (!exam) throw new NotFoundError("Exam not found");

    const candidateIds = dto.candidate_ids?.length ? dto.candidate_ids.map((id) => Number(id)) : undefined;
    if (candidateIds) assertBulkSize(candidateIds.length, "প্রার্থী");

    try {
      const candidates = await this.repository.findCandidatesByExam(madrasaId, examId, candidateIds);
      let eligible = 0;
      let ineligible = 0;

      for (const candidate of candidates) {
        if (candidate.status === ExamCandidateStatus.CANCELLED) continue;
        const evaluation = await this.eligibility.evaluate(madrasaId, {
          examId,
          studentId: candidate.studentId,
          isRegistered: true,
          requireRegistration: true,
        });
        await this.repository.updateEligibility(candidate.id, {
          eligibilityStatus: this.eligibility.eligibilityStatusFrom(evaluation),
          eligibilityReasons: JSON.stringify(evaluation.reasons),
        });
        if (evaluation.eligible) eligible += 1;
        else ineligible += 1;
      }

      return { checked: eligible + ineligible, eligible, ineligible };
    } catch (err) {
      return friendlyFailure("examCandidate.bulkCheckEligibility error:", err, "Failed to bulk-check eligibility");
    }
  }

  async getEligibilitySettings(madrasaId: number) {
    return this.eligibility.getSettings(madrasaId);
  }

  async updateEligibilitySettings(madrasaId: number, dto: Parameters<EligibilityService["updateSettings"]>[1]) {
    return this.eligibility.updateSettings(madrasaId, dto);
  }

  /* ================= STATUS ================= */

  async updateStatus(madrasaId: number, id: number, userId: number | undefined, dto: UpdateCandidateStatusRequestDto) {
    if (!EXAM_CANDIDATE_STATUSES.includes(dto.status as any)) {
      throw new BadRequestError(`Invalid status "${dto.status}"`);
    }
    try {
      const result = await this.repository.updateStatus(
        madrasaId,
        id,
        dto.status as ExamCandidateStatus,
        dto.notes,
        userId,
      );
      if (!result.count) throw new NotFoundError("Exam candidate not found");
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      return friendlyFailure("examCandidate.updateStatus error:", err, "Failed to update candidate status");
    }
  }

  async bulkUpdateStatus(madrasaId: number, userId: number | undefined, dto: BulkUpdateStatusRequestDto) {
    if (!Array.isArray(dto.ids) || !dto.ids.length) throw new BadRequestError("ids must be a non-empty array");
    assertBulkSize(dto.ids.length, "প্রার্থী");
    if (!EXAM_CANDIDATE_STATUSES.includes(dto.status as any)) {
      throw new BadRequestError(`Invalid status "${dto.status}"`);
    }
    try {
      const ids = dto.ids.map((id) => Number(id));
      const result = await this.repository.bulkUpdateStatus(madrasaId, ids, dto.status as ExamCandidateStatus, userId);
      return { updated: result.count };
    } catch (err) {
      return friendlyFailure("examCandidate.bulkUpdateStatus error:", err, "Failed to bulk-update candidate status");
    }
  }

  /** Withdrawal - a status flip to CANCELLED, not a hard delete, so the
   * registration's history/audit trail survives. */
  async cancel(madrasaId: number, id: number, userId: number | undefined) {
    try {
      const result = await this.repository.updateStatus(madrasaId, id, ExamCandidateStatus.CANCELLED, undefined, userId);
      if (!result.count) throw new NotFoundError("Exam candidate not found");
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      return friendlyFailure("examCandidate.cancel error:", err, "Failed to cancel candidate");
    }
  }
}

export const examCandidateService = new ExamCandidateService();
