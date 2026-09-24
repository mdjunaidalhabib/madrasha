import { Prisma } from "@prisma/client";
import { ApiError, BadRequestError, ConflictError, NotFoundError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import { routineRepository, RoutineRepository } from "./routine.repository";
import {
  CreateClassRoutineRequestDto,
  CreateExamRoutineRequestDto,
  UpdateClassRoutineRequestDto,
  UpdateExamRoutineRequestDto,
} from "./routine.dto";
import { MIN_DAY_OF_WEEK, MAX_DAY_OF_WEEK, TIME_FORMAT_REGEX, EXAM_ROUTINE_STATUSES } from "./routine.constants";
import { timeRangesOverlap } from "../../shared/utils/time-range.util";
import { autoRegisterForRoutine } from "../exam-candidate/exam-candidate.hooks";
import { autoActivateExamFeeForRoutine } from "../ExamPanel/exam.hooks";
import { assertExamCoversClass } from "../ExamPanel/exam-scope";

const isEmpty = (value: unknown) => value === undefined || value === null || String(value).trim() === "";

const isDuplicateError = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

const friendlyFailure = (logTag: string, err: unknown, friendlyMessage: string): never => {
  logger.error(logTag, err);
  throw new ApiError(friendlyMessage, 500);
};

const validateTimeRange = (start: unknown, end: unknown) => {
  const startStr = String(start || "");
  const endStr = String(end || "");
  if (!TIME_FORMAT_REGEX.test(startStr) || !TIME_FORMAT_REGEX.test(endStr)) {
    throw new BadRequestError("start_time/end_time must be in HH:mm 24-hour format");
  }
  if (startStr >= endStr) {
    throw new BadRequestError("start_time must be earlier than end_time");
  }
  return { startStr, endStr };
};

export class RoutineService {
  constructor(private readonly repository: RoutineRepository = routineRepository) {}

  /* ================= CLASS ROUTINE ================= */

  async listClassRoutines(madrasaId: number, classId?: number) {
    try {
      return await this.repository.findClassRoutines(madrasaId, classId);
    } catch (err) {
      return friendlyFailure("listClassRoutines error:", err, "Failed to load class routine");
    }
  }

  async createClassRoutine(madrasaId: number, dto: CreateClassRoutineRequestDto) {
    if (isEmpty(dto.class_id) || isEmpty(dto.subject) || dto.day_of_week === undefined) {
      throw new BadRequestError("class_id, day_of_week and subject are required");
    }

    const dayOfWeek = Number(dto.day_of_week);
    if (Number.isNaN(dayOfWeek) || dayOfWeek < MIN_DAY_OF_WEEK || dayOfWeek > MAX_DAY_OF_WEEK) {
      throw new BadRequestError("day_of_week must be between 0 (Sunday) and 6 (Saturday)");
    }
    const { startStr, endStr } = validateTimeRange(dto.start_time, dto.end_time);

    try {
      await this.repository.createClassRoutine(madrasaId, {
        classId: Number(dto.class_id),
        dayOfWeek,
        subject: String(dto.subject).trim(),
        teacherId: dto.teacher_id ? Number(dto.teacher_id) : null,
        startTime: startStr,
        endTime: endStr,
      });
    } catch (err) {
      if (isDuplicateError(err)) throw new ConflictError("This class routine slot already exists");
      return friendlyFailure("createClassRoutine error:", err, "Failed to create class routine");
    }
  }

  async updateClassRoutine(id: number, madrasaId: number, dto: UpdateClassRoutineRequestDto) {
    const data: Record<string, unknown> = {};

    if (dto.class_id !== undefined) data.classId = Number(dto.class_id);
    if (dto.subject !== undefined) data.subject = String(dto.subject).trim();
    if (dto.teacher_id !== undefined) data.teacherId = dto.teacher_id ? Number(dto.teacher_id) : null;
    if (dto.day_of_week !== undefined) {
      const dayOfWeek = Number(dto.day_of_week);
      if (Number.isNaN(dayOfWeek) || dayOfWeek < MIN_DAY_OF_WEEK || dayOfWeek > MAX_DAY_OF_WEEK) {
        throw new BadRequestError("day_of_week must be between 0 (Sunday) and 6 (Saturday)");
      }
      data.dayOfWeek = dayOfWeek;
    }
    if (dto.start_time !== undefined || dto.end_time !== undefined) {
      const { startStr, endStr } = validateTimeRange(dto.start_time, dto.end_time);
      data.startTime = startStr;
      data.endTime = endStr;
    }

    if (!Object.keys(data).length) throw new BadRequestError("No valid data to update");

    try {
      const result = await this.repository.updateClassRoutine(id, madrasaId, data);
      if (!result.count) throw new NotFoundError("Class routine not found");
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      return friendlyFailure("updateClassRoutine error:", err, "Failed to update class routine");
    }
  }

  async deleteClassRoutine(id: number, madrasaId: number) {
    try {
      const result = await this.repository.deleteClassRoutine(id, madrasaId);
      if (!result.count) throw new NotFoundError("Class routine not found");
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      return friendlyFailure("deleteClassRoutine error:", err, "Failed to delete class routine");
    }
  }

  /* ================= EXAM ROUTINE ================= */

  async listExamRoutines(madrasaId: number, examId?: number, classId?: number) {
    try {
      return await this.repository.findExamRoutines(madrasaId, examId, classId);
    } catch (err) {
      return friendlyFailure("listExamRoutines error:", err, "Failed to load exam routine");
    }
  }

  /** Same room, same date, overlapping time - only checked when a roomId
   * is actually set (free-text-only roomNo rows can't be reliably
   * conflict-checked and are left as-is, no regression for existing data). */
  private async assertNoRoomConflict(
    madrasaId: number,
    examDate: Date,
    startTime: string,
    endTime: string,
    roomId?: number | null,
    excludeId?: number,
  ) {
    if (!roomId) return;
    const others = await this.repository.findRoutinesByRoomAndDate(madrasaId, roomId, examDate, excludeId);
    const clash = others.find((o) => timeRangesOverlap(startTime, endTime, o.startTime, o.endTime));
    if (clash) {
      throw new ConflictError(
        `This room is already booked for another exam routine (#${clash.id}) at an overlapping time`,
      );
    }
  }

  /** Same exam+class+subject can't be scheduled twice. */
  private async assertNoClassSubjectDuplicate(
    madrasaId: number,
    examId: number,
    classId: number,
    subject: string,
    excludeId?: number,
  ) {
    const existing = await this.repository.findDuplicateClassSubject(madrasaId, examId, classId, subject, excludeId);
    if (existing) {
      throw new ConflictError("This class already has an exam routine for this subject in this exam");
    }
  }

  private validateStatus(status: unknown): string {
    const value = String(status).toUpperCase();
    if (!EXAM_ROUTINE_STATUSES.includes(value as (typeof EXAM_ROUTINE_STATUSES)[number])) {
      throw new BadRequestError(`status must be one of ${EXAM_ROUTINE_STATUSES.join(", ")}`);
    }
    return value;
  }

  async createExamRoutine(madrasaId: number, dto: CreateExamRoutineRequestDto) {
    if (isEmpty(dto.exam_id) || isEmpty(dto.class_id) || isEmpty(dto.subject) || isEmpty(dto.exam_date)) {
      throw new BadRequestError("exam_id, class_id, subject and exam_date are required");
    }
    const { startStr, endStr } = validateTimeRange(dto.start_time, dto.end_time);

    const examDate = new Date(dto.exam_date);
    if (Number.isNaN(examDate.getTime())) throw new BadRequestError("exam_date is invalid");

    const examId = Number(dto.exam_id);
    const classId = Number(dto.class_id);
    const divisionId = dto.division_id ? Number(dto.division_id) : null;
    const subject = String(dto.subject).trim();
    const roomId = dto.room_id ? Number(dto.room_id) : null;
    const maxCapacity = dto.max_capacity !== undefined && dto.max_capacity !== "" ? Number(dto.max_capacity) : null;
    const status = dto.status !== undefined ? this.validateStatus(dto.status) : "DRAFT";

    await assertExamCoversClass(madrasaId, examId, classId);
    await this.assertNoClassSubjectDuplicate(madrasaId, examId, classId, subject);
    await this.assertNoRoomConflict(madrasaId, examDate, startStr, endStr, roomId);

    try {
      await this.repository.createExamRoutine(madrasaId, {
        examId,
        classId,
        divisionId,
        subject,
        examDate,
        startTime: startStr,
        endTime: endStr,
        roomNo: dto.room_no?.trim() || null,
        roomId,
        maxCapacity,
        status,
        instructions: dto.instructions?.trim() || null,
      });
    } catch (err) {
      return friendlyFailure("createExamRoutine error:", err, "Failed to create exam routine");
    }

    // Free-exam auto-registration side effect (fee-linked exams opt out
    // internally - see autoRegisterForRoutine). Its own try/catch: a
    // registration hiccup here must never surface as a routine-creation
    // failure, since the routine itself already committed successfully.
    try {
      await autoRegisterForRoutine(madrasaId, examId, classId, divisionId, undefined);
    } catch (err) {
      logger.error("createExamRoutine auto exam-candidate registration failed:", err);
    }

    // Dormant-exam auto-activation (see exam.hooks.ts): a routine being
    // scheduled means the exam is genuinely upcoming, so its fee (if any)
    // activates now instead of waiting for a manual step. No-ops once the
    // exam is already active, so a second/third routine for it never
    // re-triggers invoices/notifications. Own try/catch, same guarantee as
    // the registration side effect above - never surfaces as a routine-
    // creation failure.
    try {
      await autoActivateExamFeeForRoutine(madrasaId, examId);
    } catch (err) {
      logger.error("createExamRoutine auto fee-activation failed:", err);
    }
  }

  async updateExamRoutine(id: number, madrasaId: number, dto: UpdateExamRoutineRequestDto) {
    const existing = await this.repository.findExamRoutineById(id, madrasaId);
    if (!existing) throw new NotFoundError("Exam routine not found");

    const data: Record<string, unknown> = {};

    if (dto.exam_id !== undefined) data.examId = Number(dto.exam_id);
    if (dto.class_id !== undefined) data.classId = Number(dto.class_id);
    if (dto.division_id !== undefined) data.divisionId = dto.division_id ? Number(dto.division_id) : null;
    if (dto.subject !== undefined) data.subject = String(dto.subject).trim();
    if (dto.room_no !== undefined) data.roomNo = dto.room_no?.trim() || null;
    if (dto.room_id !== undefined) data.roomId = dto.room_id ? Number(dto.room_id) : null;
    if (dto.max_capacity !== undefined) {
      data.maxCapacity = dto.max_capacity !== "" && dto.max_capacity !== null ? Number(dto.max_capacity) : null;
    }
    if (dto.status !== undefined) data.status = this.validateStatus(dto.status);
    if (dto.instructions !== undefined) data.instructions = dto.instructions?.trim() || null;
    if (dto.exam_date !== undefined) {
      const examDate = new Date(dto.exam_date);
      if (Number.isNaN(examDate.getTime())) throw new BadRequestError("exam_date is invalid");
      data.examDate = examDate;
    }
    if (dto.start_time !== undefined || dto.end_time !== undefined) {
      const { startStr, endStr } = validateTimeRange(
        dto.start_time ?? existing.startTime,
        dto.end_time ?? existing.endTime,
      );
      data.startTime = startStr;
      data.endTime = endStr;
    }

    if (!Object.keys(data).length) throw new BadRequestError("No valid data to update");

    // Re-run conflict checks whenever a field that affects them changes,
    // using the merged (existing + incoming) values.
    const needsSubjectCheck = ["examId", "classId", "subject"].some((k) => k in data);
    const needsRoomCheck = ["examDate", "startTime", "endTime", "roomId"].some((k) => k in data);

    if ("examId" in data || "classId" in data) {
      await assertExamCoversClass(
        madrasaId,
        (data.examId as number) ?? existing.examId,
        (data.classId as number) ?? existing.classId,
      );
    }
    if (needsSubjectCheck) {
      await this.assertNoClassSubjectDuplicate(
        madrasaId,
        (data.examId as number) ?? existing.examId,
        (data.classId as number) ?? existing.classId,
        (data.subject as string) ?? existing.subject,
        id,
      );
    }
    if (needsRoomCheck) {
      const roomId = "roomId" in data ? (data.roomId as number | null) : existing.roomId;
      await this.assertNoRoomConflict(
        madrasaId,
        (data.examDate as Date) ?? existing.examDate,
        (data.startTime as string) ?? existing.startTime,
        (data.endTime as string) ?? existing.endTime,
        roomId,
        id,
      );
    }

    try {
      const result = await this.repository.updateExamRoutine(id, madrasaId, data);
      if (!result.count) throw new NotFoundError("Exam routine not found");
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      return friendlyFailure("updateExamRoutine error:", err, "Failed to update exam routine");
    }

    // Only re-run the free-exam auto-registration side effect when this
    // update actually moved the routine to a different class/division -
    // any other field change (time, room, subject, status, ...) has no
    // bearing on which students should be candidates. Own try/catch, same
    // reasoning as createExamRoutine above.
    if ("classId" in data || "divisionId" in data) {
      try {
        const finalExamId = (data.examId as number) ?? existing.examId;
        const finalClassId = "classId" in data ? (data.classId as number) : existing.classId;
        const finalDivisionId = "divisionId" in data ? (data.divisionId as number | null) : existing.divisionId;
        await autoRegisterForRoutine(madrasaId, finalExamId, finalClassId, finalDivisionId, undefined);
      } catch (err) {
        logger.error("updateExamRoutine auto exam-candidate registration failed:", err);
      }
    }
  }

  async deleteExamRoutine(id: number, madrasaId: number) {
    try {
      const result = await this.repository.deleteExamRoutine(id, madrasaId);
      if (!result.count) throw new NotFoundError("Exam routine not found");
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      return friendlyFailure("deleteExamRoutine error:", err, "Failed to delete exam routine");
    }
  }

  /* ================= OVERVIEW ================= */

  async getClassRoutineOverview(madrasaId: number) {
    try {
      return await this.repository.findClassRoutineOverview(madrasaId);
    } catch (err) {
      return friendlyFailure("getClassRoutineOverview error:", err, "Failed to load class routine overview");
    }
  }

  async getExamRoutineOverview(madrasaId: number) {
    try {
      return await this.repository.findExamRoutineOverview(madrasaId);
    } catch (err) {
      return friendlyFailure("getExamRoutineOverview error:", err, "Failed to load exam routine overview");
    }
  }
}

export const routineService = new RoutineService();
