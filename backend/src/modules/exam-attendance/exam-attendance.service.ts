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

    const entries = new Map<number, { status: string; remarks: string | null }>();
    for (const entry of dto.entries) {
      if (isEmpty(entry.exam_candidate_id) || isEmpty(entry.status)) {
        throw new BadRequestError("Each entry requires exam_candidate_id and status");
      }
      entries.set(Number(entry.exam_candidate_id), {
        status: validateStatus(entry.status),
        remarks: entry.remarks?.trim() || null,
      });
    }

    if (dto.mark_absent_by_default) {
      const roster = await this.repository.findEligibleCandidatesForRoutine(
        madrasaId,
        routine.examId,
        routine.classId,
        routine.divisionId,
      );
      for (const candidate of roster) {
        if (!entries.has(candidate.id)) entries.set(candidate.id, { status: "ABSENT", remarks: null });
      }
    }

    try {
      for (const [examCandidateId, { status, remarks }] of entries) {
        await this.repository.upsertEntry(
          madrasaId,
          examRoutineId,
          examCandidateId,
          routine.roomId,
          status,
          remarks,
          markedById,
        );
      }
    } catch (err) {
      return friendlyFailure("bulkMark error:", err, "Failed to mark exam attendance");
    }

    return { marked: entries.size };
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
      if (!result.count) throw new NotFoundError("Exam attendance record not found");
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
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
