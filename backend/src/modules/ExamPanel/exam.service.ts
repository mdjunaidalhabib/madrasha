import { Prisma } from "@prisma/client";
import { ApiError, BadRequestError, ConflictError, NotFoundError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import { examRepository, ExamRepository } from "./exam.repository";
import { CreateExamRequestDto, SaveGradeRequestDto, UpdateFailMarkRequestDto } from "./exam.dto";
import { DEFAULT_FAIL_MARK, MIN_MARK, MAX_MARK } from "./exam.constants";

const isEmpty = (value: unknown) => value === undefined || value === null || String(value).trim() === "";

const isDuplicateError = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

/** Logs the real error and throws the same generic, friendly 500 the original controller returned. */
const friendlyFailure = (logTag: string, err: unknown, friendlyMessage: string): never => {
  logger.error(logTag, err);
  throw new ApiError(friendlyMessage, 500);
};

const validateMarkRange = (min_mark: unknown, max_mark: unknown) => {
  if (min_mark === undefined || max_mark === undefined) {
    throw new BadRequestError("Name, min_mark and max_mark are required");
  }

  const min = Number(min_mark);
  const max = Number(max_mark);

  if (Number.isNaN(min) || Number.isNaN(max)) {
    throw new BadRequestError("Marks must be numbers");
  }
  if (min < MIN_MARK || max > MAX_MARK || min > max) {
    throw new BadRequestError("Invalid mark range");
  }

  return { min, max };
};

export class ExamService {
  constructor(private readonly repository: ExamRepository = examRepository) {}

  /* ================= EXAMS ================= */

  async listExams(madrasaId: number) {
    try {
      return await this.repository.findExams(madrasaId);
    } catch (err) {
      return friendlyFailure("getExams error:", err, "Failed to load exams");
    }
  }

  async createExam(madrasaId: number, dto: CreateExamRequestDto) {
    if (isEmpty(dto.name) || isEmpty(dto.year)) {
      throw new BadRequestError("Name and year are required");
    }

    try {
      await this.repository.createExam(madrasaId, String(dto.name).trim(), String(dto.year).trim());
    } catch (err) {
      if (isDuplicateError(err)) throw new ConflictError("This exam already exists");
      return friendlyFailure("createExam error:", err, "Failed to create exam");
    }
  }

  async deleteExam(id: number, madrasaId: number) {
    try {
      const result = await this.repository.deleteExam(id, madrasaId);
      if (!result.count) throw new NotFoundError("Exam not found");
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      return friendlyFailure("deleteExam error:", err, "Failed to delete exam");
    }
  }

  /* ================= GENERAL GRADES ================= */

  async listGeneralGrades(madrasaId: number) {
    try {
      return await this.repository.findGeneralGrades(madrasaId);
    } catch (err) {
      return friendlyFailure("getGeneralGrades error:", err, "Failed to load general grades");
    }
  }

  async saveGeneralGrade(madrasaId: number, dto: SaveGradeRequestDto) {
    if (isEmpty(dto.name)) throw new BadRequestError("Name, min_mark and max_mark are required");
    const { min, max } = validateMarkRange(dto.min_mark, dto.max_mark);

    try {
      await this.repository.createGeneralGrade(madrasaId, String(dto.name).trim(), min, max);
    } catch (err) {
      if (isDuplicateError(err)) throw new ConflictError("This general grade already exists");
      return friendlyFailure("saveGeneralGrade error:", err, "Failed to save general grade");
    }
  }

  async deleteGeneralGrade(id: number, madrasaId: number) {
    try {
      const result = await this.repository.deleteGeneralGrade(id, madrasaId);
      if (!result.count) throw new NotFoundError("General grade not found");
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      return friendlyFailure("deleteGeneralGrade error:", err, "Failed to delete general grade");
    }
  }

  /* ================= MADRASA GRADES ================= */

  async listMadrasaGrades(madrasaId: number) {
    try {
      return await this.repository.findMadrasaGrades(madrasaId);
    } catch (err) {
      return friendlyFailure("getMadrasaGrades error:", err, "Failed to load madrasa grades");
    }
  }

  async saveMadrasaGrade(madrasaId: number, dto: SaveGradeRequestDto) {
    if (isEmpty(dto.name)) throw new BadRequestError("Name, min_mark and max_mark are required");
    const { min, max } = validateMarkRange(dto.min_mark, dto.max_mark);

    try {
      await this.repository.createMadrasaGrade(madrasaId, String(dto.name).trim(), min, max);
    } catch (err) {
      if (isDuplicateError(err)) throw new ConflictError("This madrasa grade already exists");
      return friendlyFailure("saveMadrasaGrade error:", err, "Failed to save madrasa grade");
    }
  }

  async deleteMadrasaGrade(id: number, madrasaId: number) {
    try {
      const result = await this.repository.deleteMadrasaGrade(id, madrasaId);
      if (!result.count) throw new NotFoundError("Madrasa grade not found");
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      return friendlyFailure("deleteMadrasaGrade error:", err, "Failed to delete madrasa grade");
    }
  }

  /* ================= SETTINGS ================= */

  async getFailMark(madrasaId: number) {
    try {
      const setting = await this.repository.findFailMarkSetting(madrasaId);
      return setting?.value || DEFAULT_FAIL_MARK;
    } catch (err) {
      return friendlyFailure("getFailMark error:", err, "Failed to load fail mark");
    }
  }

  async updateFailMark(madrasaId: number, dto: UpdateFailMarkRequestDto) {
    if (dto.value === undefined || dto.value === null || dto.value === ("" as unknown)) {
      throw new BadRequestError("Value is required");
    }

    const failValue = Number(dto.value);
    if (Number.isNaN(failValue) || failValue < MIN_MARK || failValue > MAX_MARK) {
      throw new BadRequestError("Fail mark must be a number between 0 and 100");
    }

    try {
      await this.repository.upsertFailMarkSetting(madrasaId, String(failValue));
    } catch (err) {
      return friendlyFailure("updateFailMark error:", err, "Failed to update fail mark");
    }
  }
}

export const examService = new ExamService();
