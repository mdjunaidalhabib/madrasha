import { ExamCandidateStatus } from "@prisma/client";
import { ApiError, BadRequestError, ConflictError, NotFoundError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import { examCandidateRepository, ExamCandidateRepository } from "./exam-candidate.repository";
import { eligibilityService, EligibilityService } from "./eligibility.service";
import { EXAM_CANDIDATE_STATUSES } from "./exam-candidate.constants";
import {
  BulkEligibilityCheckRequestDto,
  BulkRegisterRequestDto,
  BulkUpdateStatusRequestDto,
  EligibilityCheckRequestDto,
  EligibleStudentsQueryDto,
  ListExamCandidatesQueryDto,
  RegisterCandidateRequestDto,
  UpdateCandidateStatusRequestDto,
} from "./exam-candidate.dto";

const friendlyFailure = (logTag: string, err: unknown, friendlyMessage: string): never => {
  logger.error(logTag, err);
  throw new ApiError(friendlyMessage, 500);
};

// Exams in one of these states are no longer accepting new registrations -
// everything earlier in the lifecycle (DRAFT..RESULT_APPROVAL) still can,
// so a madrasa that never bothers flicking every intermediate status keeps
// working exactly as before.
const REGISTRATION_BLOCKED_STATUSES = new Set(["CANCELLED", "LOCKED", "PUBLISHED"]);

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

  /* ================= REGISTRATION ================= */

  private assertRegistrationOpen(exam: { status: string; name: string }) {
    if (REGISTRATION_BLOCKED_STATUSES.has(exam.status)) {
      throw new BadRequestError(`"${exam.name}" is ${exam.status.toLowerCase()} - no new registration allowed`);
    }
  }

  async register(madrasaId: number, userId: number | undefined, dto: RegisterCandidateRequestDto) {
    const examId = toId(dto.exam_id, "exam_id");
    const studentId = toId(dto.student_id, "student_id");

    const exam = await this.repository.findExam(madrasaId, examId);
    if (!exam) throw new NotFoundError("Exam not found");
    this.assertRegistrationOpen(exam);

    const student = await this.repository.findStudentForEligibility(madrasaId, studentId);
    if (!student) throw new NotFoundError("Student not found");

    try {
      const existing = await this.repository.findCandidateByExamStudent(madrasaId, examId, studentId);
      if (existing && existing.status !== ExamCandidateStatus.CANCELLED) {
        throw new ConflictError("This student is already registered for this exam");
      }

      const candidate = await this.repository.runTransaction(async (tx) => {
        if (existing) {
          return this.repository.reactivateCandidateOnTx(tx, existing.id, {
            notes: dto.notes ?? null,
            updatedBy: userId,
          });
        }
        const registrationNo = await this.repository.nextRegistrationNo(tx, madrasaId, examId);
        return this.repository.createCandidateOnTx(tx, {
          madrasaId,
          examId,
          studentId,
          sessionId: student.sessionId,
          classId: student.classId,
          divisionId: student.divisionId,
          registrationNo,
          notes: dto.notes ?? null,
          createdBy: userId ?? null,
        });
      });

      const evaluation = await this.eligibility.evaluate(madrasaId, {
        examId,
        studentId,
        isRegistered: true,
        requireRegistration: true,
      });
      await this.repository.updateEligibility(candidate.id, {
        eligibilityStatus: this.eligibility.eligibilityStatusFrom(evaluation),
        eligibilityReasons: JSON.stringify(evaluation.reasons),
      });

      return this.repository.findCandidateById(madrasaId, candidate.id);
    } catch (err) {
      if (err instanceof ConflictError || err instanceof NotFoundError) throw err;
      return friendlyFailure("examCandidate.register error:", err, "Failed to register candidate");
    }
  }

  async bulkRegister(madrasaId: number, userId: number | undefined, dto: BulkRegisterRequestDto) {
    const examId = toId(dto.exam_id, "exam_id");
    const exam = await this.repository.findExam(madrasaId, examId);
    if (!exam) throw new NotFoundError("Exam not found");
    this.assertRegistrationOpen(exam);

    let studentIds: number[];
    if (dto.student_ids?.length) {
      studentIds = dto.student_ids.map((id) => Number(id));
    } else if (dto.class_id || dto.division_id) {
      const pool = await this.repository.findEligibleStudentPool(madrasaId, {
        examId,
        classId: dto.class_id ? Number(dto.class_id) : undefined,
        divisionId: dto.division_id ? Number(dto.division_id) : undefined,
      });
      studentIds = pool.map((s) => s.id);
    } else {
      throw new BadRequestError("student_ids or class_id/division_id is required");
    }

    if (!studentIds.length) return { registered: 0, skipped: [] as Array<{ student_id: number; reason: string }> };

    const registeredIds: number[] = [];
    const skipped: Array<{ student_id: number; reason: string }> = [];

    try {
      for (const studentId of studentIds) {
        const student = await this.repository.findStudentForEligibility(madrasaId, studentId);
        if (!student) {
          skipped.push({ student_id: studentId, reason: "শিক্ষার্থী পাওয়া যায়নি" });
          continue;
        }
        const existing = await this.repository.findCandidateByExamStudent(madrasaId, examId, studentId);
        if (existing && existing.status !== ExamCandidateStatus.CANCELLED) {
          skipped.push({ student_id: studentId, reason: "ইতিমধ্যে নিবন্ধিত" });
          continue;
        }

        const candidate = await this.repository.runTransaction(async (tx) => {
          if (existing) {
            return this.repository.reactivateCandidateOnTx(tx, existing.id, { updatedBy: userId });
          }
          const registrationNo = await this.repository.nextRegistrationNo(tx, madrasaId, examId);
          return this.repository.createCandidateOnTx(tx, {
            madrasaId,
            examId,
            studentId,
            sessionId: student.sessionId,
            classId: student.classId,
            divisionId: student.divisionId,
            registrationNo,
            createdBy: userId ?? null,
          });
        });

        const evaluation = await this.eligibility.evaluate(madrasaId, {
          examId,
          studentId,
          isRegistered: true,
          requireRegistration: true,
        });
        await this.repository.updateEligibility(candidate.id, {
          eligibilityStatus: this.eligibility.eligibilityStatusFrom(evaluation),
          eligibilityReasons: JSON.stringify(evaluation.reasons),
        });
        registeredIds.push(candidate.id);
      }

      return { registered: registeredIds.length, skipped };
    } catch (err) {
      return friendlyFailure("examCandidate.bulkRegister error:", err, "Failed to bulk-register candidates");
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
