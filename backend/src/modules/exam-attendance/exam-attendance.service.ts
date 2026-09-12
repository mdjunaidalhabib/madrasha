import { ApiError, BadRequestError, LockedError, NotFoundError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import { examAttendanceRepository, ExamAttendanceRepository } from "./exam-attendance.repository";
import { BulkMarkExamAttendanceRequestDto, UpdateExamAttendanceRequestDto } from "./exam-attendance.dto";
import { EXAM_ATTENDANCE_STATUSES } from "./exam-attendance.constants";

const isEmpty = (value: unknown) => value === undefined || value === null || String(value).trim() === "";

const friendlyFailure = (logTag: string, err: unknown, friendlyMessage: string): never => {
  logger.error(logTag, err);
  throw new ApiError(friendlyMessage, 500);
};

// Bulk marking processes sequentially with per-item DB round trips - caps
// the batch so an unbounded payload can't become a request-timeout/DoS
// vector. 200 comfortably covers a full class roster.
const MAX_BULK_ENTRIES = 200;

const validateStatus = (status: unknown): string => {
  const value = String(status).toUpperCase();
  if (!EXAM_ATTENDANCE_STATUSES.includes(value as (typeof EXAM_ATTENDANCE_STATUSES)[number])) {
    throw new BadRequestError(`status must be one of ${EXAM_ATTENDANCE_STATUSES.join(", ")}`);
  }
  return value;
};

export class ExamAttendanceService {
  constructor(private readonly repository: ExamAttendanceRepository = examAttendanceRepository) {}

  async listByRoutine(madrasaId: number, examRoutineId: number, status?: string, search?: string) {
    const routine = await this.repository.findRoutineForAttendance(examRoutineId, madrasaId);
    if (!routine) throw new NotFoundError("Exam routine not found");

    try {
      return await this.repository.findRosterForRoutine(
        madrasaId,
        examRoutineId,
        routine.examId,
        routine.classId,
        routine.divisionId,
        status ? validateStatus(status) : undefined,
        search?.trim() || undefined,
      );
    } catch (err) {
      return friendlyFailure("listByRoutine error:", err, "Failed to load exam attendance");
    }
  }

  /** Lock is always applied to every row of a slot atomically (see lock()
   * below), so any one locked row proves the whole slot is locked - there
   * is no partial-lock state to worry about. */
  private async assertNotLocked(madrasaId: number, examRoutineId: number) {
    const lockedCount = await this.repository.isRoutineLocked(madrasaId, examRoutineId);
    if (lockedCount > 0) {
      throw new LockedError("This exam slot's attendance has been locked and can no longer be edited");
    }
  }

  async bulkMark(madrasaId: number, markedById: number | null, dto: BulkMarkExamAttendanceRequestDto) {
    if (isEmpty(dto.exam_routine_id) || !Array.isArray(dto.entries)) {
      throw new BadRequestError("exam_routine_id and entries are required");
    }
    const examRoutineId = Number(dto.exam_routine_id);
    await this.assertNotLocked(madrasaId, examRoutineId);

    const routine = await this.repository.findRoutineForAttendance(examRoutineId, madrasaId);
    if (!routine) throw new NotFoundError("Exam routine not found");

    // Load this routine's eligible roster up front - every exam_candidate_id
    // coming from the request body (entries[] below) must be cross-checked
    // against it, otherwise a caller could mark attendance for a candidate
    // outside this routine's class/division (or, since exam_candidate_id is
    // just an int, from a completely different tenant) by passing an
    // arbitrary id.
    const rosterIds = new Set(
      (
        await this.repository.findEligibleCandidatesForRoutine(
          madrasaId,
          routine.examId,
          routine.classId,
          routine.divisionId,
        )
      ).map((candidate) => candidate.id),
    );

    const entries = new Map<number, { status: string; remarks: string | null }>();
    for (const entry of dto.entries) {
      if (isEmpty(entry.exam_candidate_id) || isEmpty(entry.status)) {
        throw new BadRequestError("Each entry requires exam_candidate_id and status");
      }
      const examCandidateId = Number(entry.exam_candidate_id);
      if (!rosterIds.has(examCandidateId)) {
        throw new BadRequestError(`exam_candidate_id ${examCandidateId} is not on this routine's roster`);
      }
      entries.set(examCandidateId, {
        status: validateStatus(entry.status),
        remarks: entry.remarks?.trim() || null,
      });
    }

    if (dto.mark_absent_by_default) {
      for (const candidateId of rosterIds) {
        if (!entries.has(candidateId)) entries.set(candidateId, { status: "ABSENT", remarks: null });
      }
    }

    if (entries.size > MAX_BULK_ENTRIES) {
      throw new BadRequestError(`একসাথে সর্বোচ্চ ${MAX_BULK_ENTRIES}টি এন্ট্রি প্রক্রিয়া করা যায়।`);
    }

    let marked = 0;
    const rejectedLocked: number[] = [];
    try {
      for (const [examCandidateId, { status, remarks }] of entries) {
        const ok = await this.repository.upsertEntry(
          madrasaId,
          examRoutineId,
          examCandidateId,
          routine.roomId,
          status,
          remarks,
          markedById,
        );
        if (ok) marked += 1;
        else rejectedLocked.push(examCandidateId);
      }
    } catch (err) {
      return friendlyFailure("bulkMark error:", err, "Failed to mark exam attendance");
    }

    // A concurrent lock() mid-batch (see upsertEntry's WHERE is_locked =
    // false guard) can reject some entries partway through - surface that
    // instead of silently reporting the whole batch as marked.
    if (rejectedLocked.length && marked === 0) {
      throw new LockedError("This exam slot's attendance has been locked and can no longer be edited");
    }

    return { marked, locked_skipped: rejectedLocked.length };
  }

  async updateOne(id: number, madrasaId: number, dto: UpdateExamAttendanceRequestDto) {
    const existing = await this.repository.findById(id, madrasaId);
    if (!existing) throw new NotFoundError("Exam attendance record not found");
    await this.assertNotLocked(madrasaId, existing.examRoutineId);

    const data: Record<string, unknown> = {};
    if (dto.status !== undefined) data.status = validateStatus(dto.status);
    if (dto.remarks !== undefined) data.remarks = dto.remarks?.trim() || null;
    if (!Object.keys(data).length) throw new BadRequestError("No valid data to update");
    data.markedAt = new Date();

    try {
      const result = await this.repository.updateOne(id, madrasaId, data);
      if (!result.count) {
        // The row existed a moment ago (findById above) - a zero-count
        // update now most likely means a concurrent lock() landed in
        // between (see updateOne's WHERE is_locked = false guard), not that
        // the record vanished.
        throw new LockedError("This exam slot's attendance has been locked and can no longer be edited");
      }
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof LockedError) throw err;
      return friendlyFailure("updateOne error:", err, "Failed to update exam attendance");
    }
  }

  async lock(madrasaId: number, examRoutineId: number, lockedById: number | null) {
    try {
      const result = await this.repository.lockRoutine(madrasaId, examRoutineId, lockedById);
      if (!result.count) throw new NotFoundError("No exam attendance records found for this routine to lock");
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      return friendlyFailure("lock error:", err, "Failed to lock exam attendance");
    }
  }

  async unlock(madrasaId: number, examRoutineId: number) {
    try {
      const result = await this.repository.unlockRoutine(madrasaId, examRoutineId);
      if (!result.count) throw new NotFoundError("No exam attendance records found for this routine to unlock");
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      return friendlyFailure("unlock error:", err, "Failed to unlock exam attendance");
    }
  }
}

export const examAttendanceService = new ExamAttendanceService();
