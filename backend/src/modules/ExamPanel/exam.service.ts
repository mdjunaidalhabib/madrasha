import { Prisma } from "@prisma/client";
import { ApiError, BadRequestError, ConflictError, NotFoundError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import { examRepository, ExamRepository } from "./exam.repository";
import {
  CreateExamRequestDto,
  SaveGradeRequestDto,
  UpdateExamRequestDto,
  UpdateFailMarkRequestDto,
} from "./exam.dto";
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

  async updateExam(id: number, madrasaId: number, dto: UpdateExamRequestDto) {
    if (isEmpty(dto.name) || isEmpty(dto.year)) {
      throw new BadRequestError("Name and year are required");
    }

    try {
      const result = await this.repository.updateExam(
        id,
        madrasaId,
        String(dto.name).trim(),
        String(dto.year).trim(),
      );
      if (!result.count) throw new NotFoundError("Exam not found");
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      if (isDuplicateError(err)) throw new ConflictError("This exam already exists");
      return friendlyFailure("updateExam error:", err, "Failed to update exam");
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

  async reorderExams(madrasaId: number, ids: unknown) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestError("ids must be a non-empty array");
    }
    const parsedIds = ids.map((id) => Number(id));
    if (parsedIds.some((id) => !Number.isInteger(id))) {
      throw new BadRequestError("ids must all be integers");
    }

    try {
      await this.repository.reorderExams(madrasaId, parsedIds);
    } catch (err) {
      return friendlyFailure("reorderExams error:", err, "Failed to reorder exams");
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

  async updateGeneralGrade(id: number, madrasaId: number, dto: SaveGradeRequestDto) {
    if (isEmpty(dto.name)) throw new BadRequestError("Name, min_mark and max_mark are required");
    const { min, max } = validateMarkRange(dto.min_mark, dto.max_mark);

    try {
      const result = await this.repository.updateGeneralGrade(
        id,
        madrasaId,
        String(dto.name).trim(),
        min,
        max,
      );
      if (!result.count) throw new NotFoundError("General grade not found");
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      if (isDuplicateError(err)) throw new ConflictError("This general grade already exists");
      return friendlyFailure("updateGeneralGrade error:", err, "Failed to update general grade");
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

  async updateMadrasaGrade(id: number, madrasaId: number, dto: SaveGradeRequestDto) {
    if (isEmpty(dto.name)) throw new BadRequestError("Name, min_mark and max_mark are required");
    const { min, max } = validateMarkRange(dto.min_mark, dto.max_mark);

    try {
      const result = await this.repository.updateMadrasaGrade(
        id,
        madrasaId,
        String(dto.name).trim(),
        min,
        max,
      );
      if (!result.count) throw new NotFoundError("Madrasa grade not found");
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      if (isDuplicateError(err)) throw new ConflictError("This madrasa grade already exists");
      return friendlyFailure("updateMadrasaGrade error:", err, "Failed to update madrasa grade");
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
      await this.repinLowestGradeBands(madrasaId, failValue);
    } catch (err) {
      return friendlyFailure("updateFailMark error:", err, "Failed to update fail mark");
    }
  }

  // Grade bands are auto-chained (see GeneralGradeList/MadrasaGradeList on the
  // frontend): the lowest grade's minMark is always failMark + 1. Changing the
  // fail mark can leave that pinned floor stale until this re-pins it, even if
  // the admin never revisits the গ্রেড page after changing it on পরীক্ষা.
  private async repinLowestGradeBands(madrasaId: number, failValue: number) {
    const [generalGrades, madrasaGrades] = await Promise.all([
      this.repository.findGeneralGrades(madrasaId),
      this.repository.findMadrasaGrades(madrasaId),
    ]);

    const lowestGeneral = generalGrades.at(-1);
    if (lowestGeneral && lowestGeneral.minMark !== failValue + 1) {
      await this.repository.updateGeneralGrade(
        lowestGeneral.id,
        madrasaId,
        lowestGeneral.name,
        failValue + 1,
        lowestGeneral.maxMark,
      );
    }

    const lowestMadrasa = madrasaGrades.at(-1);
    if (lowestMadrasa && lowestMadrasa.minMark !== failValue + 1) {
      await this.repository.updateMadrasaGrade(
        lowestMadrasa.id,
        madrasaId,
        lowestMadrasa.name,
        failValue + 1,
        lowestMadrasa.maxMark,
      );
    }
  }
}

export const examService = new ExamService();
