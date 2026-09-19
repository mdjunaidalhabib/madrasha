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
  UpdateDivisionFailMarkRequestDto,
} from "./exam.dto";
import {
  isGeneralFailGradeName,
  isMadrasaFailGradeName,
  resolveFailMark,
  withoutFailGradeRows,
} from "../ResultPanel/division-grading";
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

/** Optional positive-integer id (query/body). Empty = no scope; anything else invalid is a 400. */
const parseOptionalId = (value: unknown, label: string): number | null => {
  if (isEmpty(value)) return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new BadRequestError(`${label} must be a positive integer`);
  return id;
};

const withDivisionId = <T extends { divisionId: number | null }>(row: T) => ({
  ...row,
  division_id: row.divisionId,
});

/** A fail grade is automatic (failed students get it as a fallback label), never a band. */
const assertNotFailGrade = (name: unknown, kind: "general" | "madrasa") => {
  if (kind === "general" && isGeneralFailGradeName(name)) {
    throw new BadRequestError("F স্বয়ংক্রিয় ফেল গ্রেড — আলাদা গ্রেড হিসেবে যোগ করা যাবে না");
  }
  if (kind === "madrasa" && isMadrasaFailGradeName(name)) {
    throw new BadRequestError("রাসিব স্বয়ংক্রিয় ফেল গ্রেড — আলাদা গ্রেড হিসেবে যোগ করা যাবে না");
  }
};

const parseFailMarkValue = (value: unknown): number => {
  if (value === undefined || value === null || value === "") throw new BadRequestError("Value is required");
  const failValue = Number(value);
  if (Number.isNaN(failValue) || failValue < MIN_MARK || failValue > MAX_MARK) {
    throw new BadRequestError("Fail mark must be a number between 0 and 100");
  }
  return failValue;
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

  /** `divisionId` omitted = the default scale; given = only that division's own rows. */
  async listGeneralGrades(madrasaId: number, divisionId?: unknown) {
    const scope = parseOptionalId(divisionId, "division_id");
    try {
      return (await this.repository.findGeneralGrades(madrasaId, scope)).map(withDivisionId);
    } catch (err) {
      return friendlyFailure("getGeneralGrades error:", err, "Failed to load general grades");
    }
  }

  async saveGeneralGrade(madrasaId: number, dto: SaveGradeRequestDto) {
    if (isEmpty(dto.name)) throw new BadRequestError("Name, min_mark and max_mark are required");
    assertNotFailGrade(dto.name, "general");
    const { min, max } = validateMarkRange(dto.min_mark, dto.max_mark);
    const point = parsePoint(dto.point);
    const scope = await this.resolveGradeScope(madrasaId, dto.division_id);

    try {
      await this.repository.createGeneralGrade(madrasaId, String(dto.name).trim(), min, max, point, scope);
    } catch (err) {
      if (isDuplicateError(err)) throw new ConflictError("This general grade already exists");
      return friendlyFailure("saveGeneralGrade error:", err, "Failed to save general grade");
    }
  }

  async updateGeneralGrade(id: number, madrasaId: number, dto: SaveGradeRequestDto) {
    if (isEmpty(dto.name)) throw new BadRequestError("Name, min_mark and max_mark are required");
    assertNotFailGrade(dto.name, "general");
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

  /** `divisionId` omitted = the default scale; given = only that division's own rows. */
  async listMadrasaGrades(madrasaId: number, divisionId?: unknown) {
    const scope = parseOptionalId(divisionId, "division_id");
    try {
      return (await this.repository.findMadrasaGrades(madrasaId, scope)).map(withDivisionId);
    } catch (err) {
      return friendlyFailure("getMadrasaGrades error:", err, "Failed to load madrasa grades");
    }
  }

  async saveMadrasaGrade(madrasaId: number, dto: SaveGradeRequestDto) {
    if (isEmpty(dto.name)) throw new BadRequestError("Name, min_mark and max_mark are required");
    assertNotFailGrade(dto.name, "madrasa");
    const { min, max } = validateMarkRange(dto.min_mark, dto.max_mark);
    const point = parsePoint(dto.point);
    const scope = await this.resolveGradeScope(madrasaId, dto.division_id);

    try {
      await this.repository.createMadrasaGrade(madrasaId, String(dto.name).trim(), min, max, point, scope);
    } catch (err) {
      if (isDuplicateError(err)) throw new ConflictError("This madrasa grade already exists");
      return friendlyFailure("saveMadrasaGrade error:", err, "Failed to save madrasa grade");
    }
  }

  async updateMadrasaGrade(id: number, madrasaId: number, dto: SaveGradeRequestDto) {
    if (isEmpty(dto.name)) throw new BadRequestError("Name, min_mark and max_mark are required");
    assertNotFailGrade(dto.name, "madrasa");
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

  /** Scope for a new grade row: null = default scale. A division scope is only
   * allowed once that division has its own fail-mark override (that override
   * is what makes it own a scale in the first place). */
  private async resolveGradeScope(madrasaId: number, rawDivisionId: unknown): Promise<number | null> {
    const divisionId = parseOptionalId(rawDivisionId, "division_id");
    if (divisionId === null) return null;

    const division = await this.repository.findActiveDivision(madrasaId, divisionId);
    if (!division) throw new BadRequestError("বিভাগটি পাওয়া যায়নি");
    if (division.failMark === null || division.failMark === undefined) {
      throw new BadRequestError(
        "এই বিভাগের নিজস্ব ফেইল মার্ক সেট করা নেই, তাই আলাদা গ্রেড যোগ করা যাবে না। আগে বিভাগের ফেইল মার্ক নির্ধারণ করুন",
      );
    }
    return divisionId;
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

  private async getGlobalFailMarkNumber(madrasaId: number): Promise<number> {
    const value = Number(await this.getFailMark(madrasaId));
    return Number.isFinite(value) ? value : Number(DEFAULT_FAIL_MARK);
  }

  /** The fail mark that actually applies to a division (or to a class's
   * division): its own override, else the madrasa-wide one. An unknown or
   * inactive division, or a class without a division, gets the global value. */
  async getEffectiveFailMark(madrasaId: number, divisionIdRaw?: unknown, classIdRaw?: unknown): Promise<number> {
    let divisionId = parseOptionalId(divisionIdRaw, "division_id");
    const classId = parseOptionalId(classIdRaw, "class_id");

    try {
      if (divisionId === null && classId !== null) {
        divisionId = await this.repository.findClassDivisionId(classId);
      }
      const global = await this.getGlobalFailMarkNumber(madrasaId);
      if (divisionId === null) return global;

      const division = await this.repository.findActiveDivision(madrasaId, divisionId);
      return resolveFailMark(division?.failMark, global);
    } catch (err) {
      return friendlyFailure("getEffectiveFailMark error:", err, "Failed to load fail mark");
    }
  }

  /** Global fail mark plus each active division's override (null = follows global). */
  async listDivisionFailMarks(madrasaId: number) {
    try {
      const [global, divisions, withGrades] = await Promise.all([
        this.getGlobalFailMarkNumber(madrasaId),
        this.repository.findActiveDivisions(madrasaId),
        this.repository.findDivisionIdsWithOwnGrades(madrasaId),
      ]);
      return {
        global,
        divisions: divisions.map((row) => ({
          division_id: row.divisionId,
          name: row.division.nameBn ?? row.division.name ?? "",
          fail_mark: row.failMark ?? null,
          has_custom_grades: withGrades.has(row.divisionId),
        })),
      };
    } catch (err) {
      return friendlyFailure("listDivisionFailMarks error:", err, "Failed to load division fail marks");
    }
  }

  /** Sets (number) or clears (null) a division's fail-mark override.
   * The first override clones the default grade scales into the division so
   * it owns editable copies; every set then repins that scale's lowest bands
   * to the fail mark. Clearing also drops the division's own grade rows so it
   * falls back to the defaults. Like updateFailMark this only saves the
   * setting - already-processed results are NOT touched; applying the change
   * is an explicit পুনঃগণনা (POST /results/recalculate) the admin confirms. */
  async updateDivisionFailMark(
    madrasaId: number,
    divisionId: number,
    dto: UpdateDivisionFailMarkRequestDto,
  ) {
    if (dto.value === undefined) throw new BadRequestError("Value is required");
    const failValue = dto.value === null ? null : parseFailMarkValue(dto.value);
    if (failValue !== null && !Number.isInteger(failValue)) {
      throw new BadRequestError("Fail mark must be a whole number between 0 and 100");
    }

    const division = await this.repository.findActiveDivision(madrasaId, divisionId);
    if (!division) throw new NotFoundError("Division not found");

    try {
      if (failValue === null) {
        await this.repository.clearDivisionOverride(madrasaId, divisionId);
      } else {
        await this.repository.setDivisionFailMark(madrasaId, divisionId, failValue);
        await this.ensureDivisionGradeScales(madrasaId, divisionId);
        await this.repinLowestGradeBands(madrasaId, failValue, divisionId);
      }
    } catch (err) {
      return friendlyFailure("updateDivisionFailMark error:", err, "Failed to update division fail mark");
    }

    return {};
  }

  /** Clones the default general + madrasa grade rows into the division, per
   * kind, only when the division has none of its own yet (an existing scale,
   * possibly hand-edited, is never overwritten). */
  private async ensureDivisionGradeScales(madrasaId: number, divisionId: number) {
    // Legacy fail-named rows (F / রাসিব) are not bands: they neither count as
    // an existing own scale nor get cloned.
    const [ownGeneral, ownMadrasa] = await Promise.all([
      this.repository.findGeneralGrades(madrasaId, divisionId).then((rows) => withoutFailGradeRows(rows, "general")),
      this.repository.findMadrasaGrades(madrasaId, divisionId).then((rows) => withoutFailGradeRows(rows, "madrasa")),
    ]);

    if (!ownGeneral.length) {
      const defaults = withoutFailGradeRows(await this.repository.findGeneralGrades(madrasaId, null), "general");
      if (defaults.length) await this.repository.createManyGeneralGrades(madrasaId, divisionId, defaults);
    }
    if (!ownMadrasa.length) {
      const defaults = withoutFailGradeRows(await this.repository.findMadrasaGrades(madrasaId, null), "madrasa");
      if (defaults.length) await this.repository.createManyMadrasaGrades(madrasaId, divisionId, defaults);
    }
  }

  /** Saves the fail mark (and re-pins the default scale's lowest bands). It
   * deliberately does NOT recalculate: already-processed results only change
   * when an admin reviews and confirms a পুনঃগণনা (POST /results/recalculate),
   * so a settings tweak never silently rewrites results. */
  async updateFailMark(madrasaId: number, dto: UpdateFailMarkRequestDto) {
    const failValue = parseFailMarkValue(dto.value);

    try {
      await this.repository.upsertFailMarkSetting(madrasaId, String(failValue));
      // Default (divisionId NULL) scale only: division-owned scales are pinned
      // to their own override and must not move with the global value.
      await this.repinLowestGradeBands(madrasaId, failValue, null);
    } catch (err) {
      return friendlyFailure("updateFailMark error:", err, "Failed to update fail mark");
    }

    return {};
  }

  // Grade bands are auto-chained (see GeneralGradeList/MadrasaGradeList on the
  // frontend): the lowest grade's minMark is always failMark (a mark equal to the fail
  // mark passes - fail is strictly below it), clamped to
  // that grade's own maxMark so a stale lowest band (predating a later
  // fail-mark increase) never ends up with min > max - the update below
  // would otherwise be rejected. Changing the fail mark can leave that
  // pinned floor stale until this re-pins it, even if the admin never
  // revisits the গ্রেড page after changing it on পরীক্ষা.
  //
  // Works per scope: divisionId null pins the default scale (global fail
  // mark), a number pins that division's own scale (its override).
  private async repinLowestGradeBands(madrasaId: number, failValue: number, divisionId: number | null) {
    // Passing bands only: a fail grade (F / রাসিব) is not a band, so a legacy
    // row with that name is never "the lowest band" and is left untouched.
    const [generalGrades, madrasaGrades] = await Promise.all([
      this.repository.findGeneralGrades(madrasaId, divisionId).then((rows) => withoutFailGradeRows(rows, "general")),
      this.repository.findMadrasaGrades(madrasaId, divisionId).then((rows) => withoutFailGradeRows(rows, "madrasa")),
    ]);

    const lowestGeneral = generalGrades.at(-1);
    if (lowestGeneral) {
      const newMin = Math.min(failValue, lowestGeneral.maxMark);
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
      const newMinMadrasa = Math.min(failValue, lowestMadrasa.maxMark);
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
