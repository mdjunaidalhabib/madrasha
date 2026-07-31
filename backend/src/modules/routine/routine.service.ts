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
import { MIN_DAY_OF_WEEK, MAX_DAY_OF_WEEK, TIME_FORMAT_REGEX } from "./routine.constants";

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

  async createExamRoutine(madrasaId: number, dto: CreateExamRoutineRequestDto) {
    if (isEmpty(dto.exam_id) || isEmpty(dto.class_id) || isEmpty(dto.subject) || isEmpty(dto.exam_date)) {
      throw new BadRequestError("exam_id, class_id, subject and exam_date are required");
    }
    const { startStr, endStr } = validateTimeRange(dto.start_time, dto.end_time);

    const examDate = new Date(dto.exam_date);
    if (Number.isNaN(examDate.getTime())) throw new BadRequestError("exam_date is invalid");

    try {
      await this.repository.createExamRoutine(madrasaId, {
        examId: Number(dto.exam_id),
        classId: Number(dto.class_id),
        subject: String(dto.subject).trim(),
        examDate,
        startTime: startStr,
        endTime: endStr,
        roomNo: dto.room_no?.trim() || null,
      });
    } catch (err) {
      return friendlyFailure("createExamRoutine error:", err, "Failed to create exam routine");
    }
  }

  async updateExamRoutine(id: number, madrasaId: number, dto: UpdateExamRoutineRequestDto) {
    const data: Record<string, unknown> = {};

    if (dto.exam_id !== undefined) data.examId = Number(dto.exam_id);
    if (dto.class_id !== undefined) data.classId = Number(dto.class_id);
    if (dto.subject !== undefined) data.subject = String(dto.subject).trim();
    if (dto.room_no !== undefined) data.roomNo = dto.room_no?.trim() || null;
    if (dto.exam_date !== undefined) {
      const examDate = new Date(dto.exam_date);
      if (Number.isNaN(examDate.getTime())) throw new BadRequestError("exam_date is invalid");
      data.examDate = examDate;
    }
    if (dto.start_time !== undefined || dto.end_time !== undefined) {
      const { startStr, endStr } = validateTimeRange(dto.start_time, dto.end_time);
      data.startTime = startStr;
      data.endTime = endStr;
    }

    if (!Object.keys(data).length) throw new BadRequestError("No valid data to update");

    try {
      const result = await this.repository.updateExamRoutine(id, madrasaId, data);
      if (!result.count) throw new NotFoundError("Exam routine not found");
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      return friendlyFailure("updateExamRoutine error:", err, "Failed to update exam routine");
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
}

export const routineService = new RoutineService();
