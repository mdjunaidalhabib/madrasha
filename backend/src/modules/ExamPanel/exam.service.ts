import { Prisma } from "@prisma/client";
import { ApiError, BadRequestError, ConflictError, NotFoundError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import { examRepository, ExamRepository } from "./exam.repository";
import { sessionRepository, SessionRepository } from "../session/session.repository";
import { feeService } from "../fee/fee.service";
import {
  CreateExamRequestDto,
  SaveGradeRequestDto,
  UpdateExamRequestDto,
  UpdateExamStatusRequestDto,
  UpdateFailMarkRequestDto,
} from "./exam.dto";
import { DEFAULT_FAIL_MARK, MIN_MARK, MAX_MARK, EXAM_STATUSES } from "./exam.constants";

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

const parsePoint = (point: unknown): number | null => {
  if (isEmpty(point)) return null;
  const value = Number(point);
  if (!Number.isFinite(value) || value < 0) {
    throw new BadRequestError("Point must be a non-negative number");
  }
  return value;
};

export class ExamService {
  constructor(
    private readonly repository: ExamRepository = examRepository,
    private readonly sessions: SessionRepository = sessionRepository,
  ) {}

  /* ================= EXAMS ================= */

  async listExams(madrasaId: number, activeOnly = false) {
    try {
      const exams = await this.repository.findExams(madrasaId, activeOnly);
      return exams.map((exam) => {
        const { _count, ...rest } = exam as typeof exam & { _count: { feeStructures: number } };
        return { ...rest, has_fee_link: _count.feeStructures > 0 };
      });
    } catch (err) {
      return friendlyFailure("getExams error:", err, "Failed to load exams");
    }
  }

  async createExam(madrasaId: number, dto: CreateExamRequestDto) {
    if (isEmpty(dto.name)) {
      throw new BadRequestError("Name is required");
    }

    const currentSession = await this.sessions.findCurrentSession(madrasaId);
    if (!currentSession) {
      throw new BadRequestError("No current session found. Please set a current session first.");
    }

    const extra = this.buildExamMasterFields(dto);

    try {
      await this.repository.createExam(madrasaId, String(dto.name).trim(), currentSession.name, extra);
    } catch (err) {
      if (isDuplicateError(err)) throw new ConflictError("This exam already exists");
      return friendlyFailure("createExam error:", err, "Failed to create exam");
    }
  }

  async updateExam(id: number, madrasaId: number, dto: UpdateExamRequestDto) {
    const data: Record<string, unknown> = this.buildExamMasterFields(dto);
    if (dto.name !== undefined) {
      if (isEmpty(dto.name)) throw new BadRequestError("Name cannot be empty");
      data.name = String(dto.name).trim();
    }
    if (dto.is_active !== undefined) data.isActive = Boolean(dto.is_active);

    if (!Object.keys(data).length) throw new BadRequestError("No valid data to update");

    try {
      const result = await this.repository.updateExam(id, madrasaId, data);
      if (!result.count) throw new NotFoundError("Exam not found");
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      if (isDuplicateError(err)) throw new ConflictError("This exam already exists");
      return friendlyFailure("updateExam error:", err, "Failed to update exam");
    }
  }

  /** Shared Exam Master field parsing for create/update - only ever
   * includes keys the caller actually sent, so a partial update never
   * clobbers fields it didn't mention. */
  private buildExamMasterFields(dto: { exam_type?: string; start_date?: string; end_date?: string; description?: string }) {
    const data: Record<string, unknown> = {};
    if (dto.exam_type !== undefined) data.examType = isEmpty(dto.exam_type) ? null : String(dto.exam_type).trim();
    if (dto.description !== undefined) data.description = isEmpty(dto.description) ? null : String(dto.description).trim();
    if (dto.start_date !== undefined) data.startDate = this.parseDateOrNull(dto.start_date, "start_date");
    if (dto.end_date !== undefined) data.endDate = this.parseDateOrNull(dto.end_date, "end_date");

    if (data.startDate && data.endDate && data.startDate > data.endDate) {
      throw new BadRequestError("start_date cannot be after end_date");
    }
    return data;
  }

  private parseDateOrNull(value: string, label: string): Date | null {
    if (isEmpty(value)) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestError(`Invalid ${label}`);
    return date;
  }

  async updateExamStatus(id: number, madrasaId: number, dto: UpdateExamStatusRequestDto) {
    if (isEmpty(dto.status) || !EXAM_STATUSES.includes(dto.status as any)) {
      throw new BadRequestError(`Invalid status "${dto.status}"`);
    }
    try {
      const result = await this.repository.updateExamStatus(id, madrasaId, dto.status);
      if (!result.count) throw new NotFoundError("Exam not found");
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      return friendlyFailure("updateExamStatus error:", err, "Failed to update exam status");
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

  /** Bare isActive check for exam.hooks.ts's autoActivateExamFeeForRoutine -
   * kept minimal (no fee/session joins) since it only needs to decide
   * whether activateExamFee is worth calling at all. */
  async findExamForRoutineHook(examId: number, madrasaId: number) {
    const exam = await this.repository.findExamById(examId, madrasaId);
    return exam ? { isActive: exam.isActive } : null;
  }

  /** Turns a dormant exam (see createDefaultExamsOnTx/the DormantExams
   * spec) into a live one: activates the exam itself, activates its
   * linked FeeStructure row(s), bills every currently-enrolled student
   * covered by them, and notifies their guardians. Called either directly
   * (POST /exams/:id/activate-fee) or automatically the first time this
   * exam gets a routine (see exam.hooks.ts's autoActivateExamFeeForRoutine).
   *
   * Steps 2-4 each get their own try/catch: a fee/invoice/notification
   * hiccup must never undo step 1 (the exam is already committed active by
   * the time any of them run), and one failing must never block the next. */
  async activateExamFee(examId: number, madrasaId: number) {
    const exam = await this.repository.findExamById(examId, madrasaId);
    if (!exam) throw new NotFoundError("Exam not found");

    const result = await this.repository.updateExam(examId, madrasaId, { isActive: true });
    if (!result.count) throw new NotFoundError("Exam not found");

    let feeStructuresActivated = 0;
    try {
      feeStructuresActivated = await feeService.activateExamLinkedFee(madrasaId, examId);
    } catch (err) {
      logger.error("activateExamFee: fee-structure activation failed:", err);
    }

    let invoicesCreated = 0;
    try {
      const backfill = await feeService.backfillInvoicesForExam(madrasaId, examId);
      invoicesCreated = backfill.invoicesCreated;
    } catch (err) {
      logger.error("activateExamFee: invoice backfill failed:", err);
    }

    let studentsNotified = 0;
    try {
      studentsNotified = await feeService.notifyGuardiansOfExamFee(madrasaId, examId, exam.name);
    } catch (err) {
      logger.error("activateExamFee: guardian notification failed:", err);
    }

    return { feeStructuresActivated, invoicesCreated, studentsNotified };
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
    const point = parsePoint(dto.point);

    try {
      await this.repository.createGeneralGrade(madrasaId, String(dto.name).trim(), min, max, point);
    } catch (err) {
      if (isDuplicateError(err)) throw new ConflictError("This general grade already exists");
      return friendlyFailure("saveGeneralGrade error:", err, "Failed to save general grade");
    }
  }

  async updateGeneralGrade(id: number, madrasaId: number, dto: SaveGradeRequestDto) {
    if (isEmpty(dto.name)) throw new BadRequestError("Name, min_mark and max_mark are required");
    const { min, max } = validateMarkRange(dto.min_mark, dto.max_mark);
    const point = parsePoint(dto.point);

    try {
      const result = await this.repository.updateGeneralGrade(
        id,
        madrasaId,
        String(dto.name).trim(),
        min,
        max,
        point,
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
    const point = parsePoint(dto.point);

    try {
      await this.repository.createMadrasaGrade(madrasaId, String(dto.name).trim(), min, max, point);
    } catch (err) {
      if (isDuplicateError(err)) throw new ConflictError("This madrasa grade already exists");
      return friendlyFailure("saveMadrasaGrade error:", err, "Failed to save madrasa grade");
    }
  }

  async updateMadrasaGrade(id: number, madrasaId: number, dto: SaveGradeRequestDto) {
    if (isEmpty(dto.name)) throw new BadRequestError("Name, min_mark and max_mark are required");
    const { min, max } = validateMarkRange(dto.min_mark, dto.max_mark);
    const point = parsePoint(dto.point);

    try {
      const result = await this.repository.updateMadrasaGrade(
        id,
        madrasaId,
        String(dto.name).trim(),
        min,
        max,
        point,
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
  // frontend): the lowest grade's minMark is always failMark + 1, clamped to
  // that grade's own maxMark so a stale lowest band (predating a later
  // fail-mark increase) never ends up with min > max - the update below
  // would otherwise be rejected. Changing the fail mark can leave that
  // pinned floor stale until this re-pins it, even if the admin never
  // revisits the গ্রেড page after changing it on পরীক্ষা.
  private async repinLowestGradeBands(madrasaId: number, failValue: number) {
    const [generalGrades, madrasaGrades] = await Promise.all([
      this.repository.findGeneralGrades(madrasaId),
      this.repository.findMadrasaGrades(madrasaId),
    ]);

    const lowestGeneral = generalGrades.at(-1);
    if (lowestGeneral) {
      const newMin = Math.min(failValue + 1, lowestGeneral.maxMark);
      if (lowestGeneral.minMark !== newMin) {
        await this.repository.updateGeneralGrade(
          lowestGeneral.id,
          madrasaId,
          lowestGeneral.name,
          newMin,
          lowestGeneral.maxMark,
          lowestGeneral.point,
        );
      }
    }

    const lowestMadrasa = madrasaGrades.at(-1);
    if (lowestMadrasa) {
      const newMinMadrasa = Math.min(failValue + 1, lowestMadrasa.maxMark);
      if (lowestMadrasa.minMark !== newMinMadrasa) {
        await this.repository.updateMadrasaGrade(
          lowestMadrasa.id,
          madrasaId,
          lowestMadrasa.name,
          newMinMadrasa,
          lowestMadrasa.maxMark,
          lowestMadrasa.point,
        );
      }
    }
  }
}

export const examService = new ExamService();
