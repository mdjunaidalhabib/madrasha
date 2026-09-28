import { Prisma } from "@prisma/client";
import { ApiError, BadRequestError, ConflictError, NotFoundError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import { examRepository, ExamRepository } from "./exam.repository";
import { sessionRepository, SessionRepository } from "../session/session.repository";
import { examFeeService } from "../fee/exam-fee.service";
import {
  CreateExamRequestDto,
  SaveGradeRequestDto,
  UpdateExamRequestDto,
  UpdateFailMarkRequestDto,
  UpdateDivisionFailMarkRequestDto,
} from "./exam.dto";
import {
  isGeneralFailGradeName,
  isMadrasaFailGradeName,
  resolveFailMark,
  withoutFailGradeRows,
} from "../ResultPanel/division-grading";
import { DEFAULT_FAIL_MARK, MIN_MARK, MAX_MARK } from "./exam.constants";
import { tenantDivisionName, linkName } from "../../shared/utils/tenant-name.util";
import { t } from "../../shared/i18n";

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
    throw new BadRequestError(t({ bn: "নাম, min_mark ও max_mark আবশ্যক", en: "Name, min_mark and max_mark are required" }));
  }

  const min = Number(min_mark);
  const max = Number(max_mark);

  if (Number.isNaN(min) || Number.isNaN(max)) {
    throw new BadRequestError(t({ bn: "নম্বর অবশ্যই সংখ্যা হতে হবে", en: "Marks must be numbers" }));
  }
  if (min < MIN_MARK || max > MAX_MARK || min > max) {
    throw new BadRequestError(t({ bn: "নম্বরের সীমা সঠিক নয়", en: "Invalid mark range" }));
  }

  return { min, max };
};

const parsePoint = (point: unknown): number | null => {
  if (isEmpty(point)) return null;
  const value = Number(point);
  if (!Number.isFinite(value) || value < 0) {
    throw new BadRequestError(t({ bn: "পয়েন্ট অবশ্যই ঋণাত্মক নয় এমন সংখ্যা হতে হবে", en: "Point must be a non-negative number" }));
  }
  return value;
};

/** Optional positive-integer id (query/body). Empty = no scope; anything else invalid is a 400. */
const parseOptionalId = (value: unknown, label: string): number | null => {
  if (isEmpty(value)) return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new BadRequestError(t({ bn: `${label} অবশ্যই ধনাত্মক পূর্ণসংখ্যা হতে হবে`, en: `${label} must be a positive integer` }));
  return id;
};

/** Two division scopes collide when either is "সকল বিভাগ" (empty) or they share a division. */
const scopesOverlap = (a: number[], b: number[]) =>
  a.length === 0 || b.length === 0 || a.some((id) => b.includes(id));

const withDivisionId = <T extends { divisionId: number | null }>(row: T) => ({
  ...row,
  division_id: row.divisionId,
});

/** A fail grade is automatic (failed students get it as a fallback label), never a band. */
const assertNotFailGrade = (name: unknown, kind: "general" | "madrasa") => {
  if (kind === "general" && isGeneralFailGradeName(name)) {
    throw new BadRequestError(t({ bn: "F স্বয়ংক্রিয় ফেল গ্রেড — আলাদা গ্রেড হিসেবে যোগ করা যাবে না", en: "F is the automatic fail grade — it cannot be added as a separate grade" }));
  }
  if (kind === "madrasa" && isMadrasaFailGradeName(name)) {
    throw new BadRequestError(t({ bn: "রাসিব স্বয়ংক্রিয় ফেল গ্রেড — আলাদা গ্রেড হিসেবে যোগ করা যাবে না", en: "Rasib is the automatic fail grade — it cannot be added as a separate grade" }));
  }
};

const parseFailMarkValue = (value: unknown): number => {
  if (value === undefined || value === null || value === "") throw new BadRequestError(t({ bn: "মান আবশ্যক", en: "Value is required" }));
  const failValue = Number(value);
  if (Number.isNaN(failValue) || failValue < MIN_MARK || failValue > MAX_MARK) {
    throw new BadRequestError(t({ bn: "ফেল মার্ক অবশ্যই 0 থেকে 100 এর মধ্যে একটি সংখ্যা হতে হবে", en: "Fail mark must be a number between 0 and 100" }));
  }
  return failValue;
};

export class ExamService {
  constructor(
    private readonly repository: ExamRepository = examRepository,
    private readonly sessions: SessionRepository = sessionRepository,
  ) {}

  /* ================= EXAMS ================= */

  async listExams(madrasaId: number, activeOnly = false, divisionIdInput?: unknown) {
    const divisionId = parseOptionalId(divisionIdInput, "division_id");
    try {
      const exams = await this.repository.findExams(madrasaId, activeOnly, divisionId);
      return exams.map((exam) => {
        const { _count, divisions, ...rest } = exam;
        return {
          ...rest,
          has_fee_link: _count.feeStructures > 0,
          // বিভাগভিত্তিক scope: empty division_ids = সকল বিভাগ.
          all_divisions: divisions.length === 0,
          division_ids: divisions.map((d) => d.divisionId),
          divisions: divisions.map((d) => ({ division_id: d.divisionId, division_name_bn: tenantDivisionName(d.division) })),
        };
      });
    } catch (err) {
      return friendlyFailure("getExams error:", err, t({ bn: "পরীক্ষার তালিকা লোড করা যায়নি", en: "Failed to load exams" }));
    }
  }

  async createExam(madrasaId: number, dto: CreateExamRequestDto) {
    if (isEmpty(dto.name)) {
      throw new BadRequestError(t({ bn: "নাম আবশ্যক", en: "Name is required" }));
    }

    const currentSession = await this.sessions.findCurrentSession(madrasaId);
    if (!currentSession) {
      throw new BadRequestError(t({ bn: "কোনো চলতি সেশন পাওয়া যায়নি। আগে একটি চলতি সেশন নির্ধারণ করুন।", en: "No current session found. Please set a current session first." }));
    }

    const extra = this.buildExamMasterFields(dto);
    const name = String(dto.name).trim();
    const divisionIds = await this.parseDivisionIds(madrasaId, dto.division_ids ?? []);
    await this.assertNoOverlappingExam(madrasaId, name, currentSession.name, divisionIds);

    let examId: number;
    try {
      const exam = await this.repository.createExam(madrasaId, name, currentSession.name, extra, divisionIds);
      examId = exam.id;
    } catch (err) {
      if (isDuplicateError(err)) throw new ConflictError(t({ bn: "এই পরীক্ষাটি ইতিমধ্যে আছে", en: "This exam already exists" }));
      return friendlyFailure("createExam error:", err, t({ bn: "পরীক্ষা তৈরি করা যায়নি", en: "Failed to create exam" }));
    }

    // পরীক্ষার ফি rows for every class this exam covers (dormant until the
    // exam's fee is activated). Never fails the exam creation itself.
    await this.syncExamFeeSafely(madrasaId, examId);
  }

  private async syncExamFeeSafely(madrasaId: number, examId: number) {
    try {
      await examFeeService.syncExam(madrasaId, examId);
    } catch (err) {
      logger.error("exam fee sync failed:", err);
    }
  }

  async updateExam(id: number, madrasaId: number, dto: UpdateExamRequestDto) {
    const data: Record<string, unknown> = this.buildExamMasterFields(dto);
    if (dto.name !== undefined) {
      if (isEmpty(dto.name)) throw new BadRequestError(t({ bn: "নাম খালি রাখা যাবে না", en: "Name cannot be empty" }));
      data.name = String(dto.name).trim();
    }
    if (dto.is_active !== undefined) data.isActive = Boolean(dto.is_active);

    const divisionIds =
      dto.division_ids === undefined ? undefined : await this.parseDivisionIds(madrasaId, dto.division_ids);

    if (!Object.keys(data).length && divisionIds === undefined) {
      throw new BadRequestError(t({ bn: "আপডেট করার মতো কোনো সঠিক তথ্য নেই", en: "No valid data to update" }));
    }

    const current =
      data.name !== undefined || divisionIds !== undefined
        ? await this.repository.findExamById(id, madrasaId)
        : null;

    // Name or scope changing -> re-run the overlap-aware duplicate check
    // against the exam's resulting (name, year, divisions).
    if (data.name !== undefined || divisionIds !== undefined) {
      if (!current) throw new NotFoundError(t({ bn: "পরীক্ষা পাওয়া যায়নি", en: "Exam not found" }));
      await this.assertNoOverlappingExam(
        madrasaId,
        (data.name as string | undefined) ?? current.name,
        current.year,
        divisionIds ?? current.divisions.map((d) => d.divisionId),
        id,
      );
    }

    try {
      const result = await this.repository.updateExam(id, madrasaId, data, divisionIds);
      if (!result.count) throw new NotFoundError(t({ bn: "পরীক্ষা পাওয়া যায়নি", en: "Exam not found" }));
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      if (isDuplicateError(err)) throw new ConflictError(t({ bn: "এই পরীক্ষাটি ইতিমধ্যে আছে", en: "This exam already exists" }));
      return friendlyFailure("updateExam error:", err, t({ bn: "পরীক্ষা আপডেট করা যায়নি", en: "Failed to update exam" }));
    }

    // বিভাগ scope changed -> its পরীক্ষার ফি follows (classes added/removed).
    if (divisionIds !== undefined) await this.syncExamFeeSafely(madrasaId, id);

    // তা'লীমাত only switches the exam. Its পরীক্ষার ফি is ইহতেমাম's own
    // switch (ExamFeeService.setFeeActive): switching the exam off stops
    // the fee with it, switching it back on leaves the fee off until
    // ইহতেমাম turns it on again.
    if (data.isActive === false) await this.deactivateExamFeeSafely(madrasaId, id);
  }

  private async deactivateExamFeeSafely(madrasaId: number, examId: number) {
    try {
      await examFeeService.deactivateFee(madrasaId, examId);
    } catch (err) {
      logger.error("exam fee deactivation failed:", err);
    }
  }

  /** Dedupes + validates the requested division scope against this
   * madrasa's active divisions. Empty = সকল বিভাগ. Selecting every active
   * division is also normalised to empty, so a division activated later is
   * automatically covered by an exam that was meant for "everyone". */
  private async parseDivisionIds(madrasaId: number, raw: unknown[]): Promise<number[]> {
    const ids = [...new Set(raw.map((v) => Number(v)))];
    if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
      throw new BadRequestError(t({ bn: "division_ids অবশ্যই ধনাত্মক পূর্ণসংখ্যা হতে হবে", en: "division_ids must be positive integers" }));
    }
    if (!ids.length) return [];

    const active = await this.repository.findActiveDivisions(madrasaId);
    const activeIds = new Set(active.map((d) => d.divisionId));
    if (ids.some((id) => !activeIds.has(id))) {
      throw new BadRequestError(t({ bn: "নির্বাচিত বিভাগটি এই প্রতিষ্ঠানে সক্রিয় নেই", en: "The selected division is not active in this institution" }));
    }
    if (ids.length === activeIds.size) return [];
    return ids.sort((a, b) => a - b);
  }

  /** Same name + year may exist more than once only for non-overlapping
   * division scopes (e.g. হিফজ বিভাগ ও কিতাব বিভাগের আলাদা "বার্ষিক পরীক্ষা"). */
  private async assertNoOverlappingExam(
    madrasaId: number,
    name: string,
    year: string,
    divisionIds: number[],
    excludeExamId?: number,
  ) {
    const sameName = await this.repository.findExamsByNameAndYear(madrasaId, name, year);
    const clash = sameName.some(
      (exam) =>
        exam.id !== excludeExamId &&
        scopesOverlap(
          divisionIds,
          exam.divisions.map((d) => d.divisionId),
        ),
    );
    if (clash) {
      throw new ConflictError(t({ bn: "এই নামে এই বিভাগের জন্য চলতি সেশনে ইতিমধ্যে একটি পরীক্ষা আছে", en: "An exam with this name already exists for this division in the current session" }));
    }
  }

  /** Whether an exam is held for the given division (সকল বিভাগ exams cover
   * every division). Used by routine/mark writes to refuse data for a
   * division the exam doesn't belong to. A null division (class with no
   * division) is only covered by a সকল বিভাগ exam. */
  async examCoversDivision(examId: number, madrasaId: number, divisionId: number | null): Promise<boolean> {
    const exam = await this.repository.findExamById(examId, madrasaId);
    if (!exam) return false;
    if (!exam.divisions.length) return true;
    return divisionId !== null && exam.divisions.some((d) => d.divisionId === divisionId);
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
      throw new BadRequestError(t({ bn: "start_date, end_date-এর পরে হতে পারবে না", en: "start_date cannot be after end_date" }));
    }
    return data;
  }

  private parseDateOrNull(value: string, label: string): Date | null {
    if (isEmpty(value)) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestError(t({ bn: `${label} সঠিক নয়`, en: `Invalid ${label}` }));
    return date;
  }

  async deleteExam(id: number, madrasaId: number) {
    try {
      const result = await this.repository.deleteExam(id, madrasaId);
      if (!result.count) throw new NotFoundError(t({ bn: "পরীক্ষা পাওয়া যায়নি", en: "Exam not found" }));
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      return friendlyFailure("deleteExam error:", err, t({ bn: "পরীক্ষা মুছে ফেলা যায়নি", en: "Failed to delete exam" }));
    }
  }

  /** Switches a dormant exam on the first time it gets a routine (see
   * exam.hooks.ts). Only the exam itself - its পরীক্ষার ফি stays whatever
   * ইহতেমাম set it to (ExamFeeService.setFeeActive). Returns whether the
   * exam was actually switched on. */
  async activateExamForRoutine(examId: number, madrasaId: number) {
    const exam = await this.repository.findExamById(examId, madrasaId);
    if (!exam || exam.isActive) return false;
    const result = await this.repository.updateExam(examId, madrasaId, { isActive: true });
    return result.count > 0;
  }

  async reorderExams(madrasaId: number, ids: unknown) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestError(t({ bn: "ids একটি খালি নয় এমন তালিকা হতে হবে", en: "ids must be a non-empty array" }));
    }
    const parsedIds = ids.map((id) => Number(id));
    if (parsedIds.some((id) => !Number.isInteger(id))) {
      throw new BadRequestError(t({ bn: "সব ids অবশ্যই পূর্ণসংখ্যা হতে হবে", en: "ids must all be integers" }));
    }

    try {
      await this.repository.reorderExams(madrasaId, parsedIds);
    } catch (err) {
      return friendlyFailure("reorderExams error:", err, t({ bn: "পরীক্ষার ক্রম পরিবর্তন করা যায়নি", en: "Failed to reorder exams" }));
    }
  }

  /* ================= GENERAL GRADES ================= */

  /** `divisionId` omitted = the default scale; given = only that division's own rows. */
  async listGeneralGrades(madrasaId: number, divisionId?: unknown) {
    const scope = parseOptionalId(divisionId, "division_id");
    try {
      return (await this.repository.findGeneralGrades(madrasaId, scope)).map(withDivisionId);
    } catch (err) {
      return friendlyFailure("getGeneralGrades error:", err, t({ bn: "সাধারণ গ্রেড লোড করা যায়নি", en: "Failed to load general grades" }));
    }
  }

  async saveGeneralGrade(madrasaId: number, dto: SaveGradeRequestDto) {
    if (isEmpty(dto.name)) throw new BadRequestError(t({ bn: "নাম, min_mark ও max_mark আবশ্যক", en: "Name, min_mark and max_mark are required" }));
    assertNotFailGrade(dto.name, "general");
    const { min, max } = validateMarkRange(dto.min_mark, dto.max_mark);
    const point = parsePoint(dto.point);
    const scope = await this.resolveGradeScope(madrasaId, dto.division_id);

    try {
      await this.repository.createGeneralGrade(madrasaId, String(dto.name).trim(), min, max, point, scope);
    } catch (err) {
      if (isDuplicateError(err)) throw new ConflictError(t({ bn: "এই সাধারণ গ্রেডটি ইতিমধ্যে আছে", en: "This general grade already exists" }));
      return friendlyFailure("saveGeneralGrade error:", err, t({ bn: "সাধারণ গ্রেড সংরক্ষণ করা যায়নি", en: "Failed to save general grade" }));
    }
  }

  async updateGeneralGrade(id: number, madrasaId: number, dto: SaveGradeRequestDto) {
    if (isEmpty(dto.name)) throw new BadRequestError(t({ bn: "নাম, min_mark ও max_mark আবশ্যক", en: "Name, min_mark and max_mark are required" }));
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
      if (!result.count) throw new NotFoundError(t({ bn: "সাধারণ গ্রেড পাওয়া যায়নি", en: "General grade not found" }));
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      if (isDuplicateError(err)) throw new ConflictError(t({ bn: "এই সাধারণ গ্রেডটি ইতিমধ্যে আছে", en: "This general grade already exists" }));
      return friendlyFailure("updateGeneralGrade error:", err, t({ bn: "সাধারণ গ্রেড আপডেট করা যায়নি", en: "Failed to update general grade" }));
    }
  }

  async deleteGeneralGrade(id: number, madrasaId: number) {
    try {
      const result = await this.repository.deleteGeneralGrade(id, madrasaId);
      if (!result.count) throw new NotFoundError(t({ bn: "সাধারণ গ্রেড পাওয়া যায়নি", en: "General grade not found" }));
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      return friendlyFailure("deleteGeneralGrade error:", err, t({ bn: "সাধারণ গ্রেড মুছে ফেলা যায়নি", en: "Failed to delete general grade" }));
    }
  }

  /* ================= MADRASA GRADES ================= */

  /** `divisionId` omitted = the default scale; given = only that division's own rows. */
  async listMadrasaGrades(madrasaId: number, divisionId?: unknown) {
    const scope = parseOptionalId(divisionId, "division_id");
    try {
      return (await this.repository.findMadrasaGrades(madrasaId, scope)).map(withDivisionId);
    } catch (err) {
      return friendlyFailure("getMadrasaGrades error:", err, t({ bn: "মাদ্রাসা গ্রেড লোড করা যায়নি", en: "Failed to load madrasa grades" }));
    }
  }

  async saveMadrasaGrade(madrasaId: number, dto: SaveGradeRequestDto) {
    if (isEmpty(dto.name)) throw new BadRequestError(t({ bn: "নাম, min_mark ও max_mark আবশ্যক", en: "Name, min_mark and max_mark are required" }));
    assertNotFailGrade(dto.name, "madrasa");
    const { min, max } = validateMarkRange(dto.min_mark, dto.max_mark);
    const point = parsePoint(dto.point);
    const scope = await this.resolveGradeScope(madrasaId, dto.division_id);

    try {
      await this.repository.createMadrasaGrade(madrasaId, String(dto.name).trim(), min, max, point, scope);
    } catch (err) {
      if (isDuplicateError(err)) throw new ConflictError(t({ bn: "এই মাদ্রাসা গ্রেডটি ইতিমধ্যে আছে", en: "This madrasa grade already exists" }));
      return friendlyFailure("saveMadrasaGrade error:", err, t({ bn: "মাদ্রাসা গ্রেড সংরক্ষণ করা যায়নি", en: "Failed to save madrasa grade" }));
    }
  }

  async updateMadrasaGrade(id: number, madrasaId: number, dto: SaveGradeRequestDto) {
    if (isEmpty(dto.name)) throw new BadRequestError(t({ bn: "নাম, min_mark ও max_mark আবশ্যক", en: "Name, min_mark and max_mark are required" }));
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
      if (!result.count) throw new NotFoundError(t({ bn: "মাদ্রাসা গ্রেড পাওয়া যায়নি", en: "Madrasa grade not found" }));
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      if (isDuplicateError(err)) throw new ConflictError(t({ bn: "এই মাদ্রাসা গ্রেডটি ইতিমধ্যে আছে", en: "This madrasa grade already exists" }));
      return friendlyFailure("updateMadrasaGrade error:", err, t({ bn: "মাদ্রাসা গ্রেড আপডেট করা যায়নি", en: "Failed to update madrasa grade" }));
    }
  }

  async deleteMadrasaGrade(id: number, madrasaId: number) {
    try {
      const result = await this.repository.deleteMadrasaGrade(id, madrasaId);
      if (!result.count) throw new NotFoundError(t({ bn: "মাদ্রাসা গ্রেড পাওয়া যায়নি", en: "Madrasa grade not found" }));
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      return friendlyFailure("deleteMadrasaGrade error:", err, t({ bn: "মাদ্রাসা গ্রেড মুছে ফেলা যায়নি", en: "Failed to delete madrasa grade" }));
    }
  }

  /** Scope for a new grade row: null = default scale. A division scope is only
   * allowed once that division has its own fail-mark override (that override
   * is what makes it own a scale in the first place). */
  private async resolveGradeScope(madrasaId: number, rawDivisionId: unknown): Promise<number | null> {
    const divisionId = parseOptionalId(rawDivisionId, "division_id");
    if (divisionId === null) return null;

    const division = await this.repository.findActiveDivision(madrasaId, divisionId);
    if (!division) throw new BadRequestError(t({ bn: "বিভাগটি পাওয়া যায়নি", en: "Division not found" }));
    if (division.failMark === null || division.failMark === undefined) {
      throw new BadRequestError(
        t({ bn: "এই বিভাগের নিজস্ব ফেইল মার্ক সেট করা নেই, তাই আলাদা গ্রেড যোগ করা যাবে না। আগে বিভাগের ফেইল মার্ক নির্ধারণ করুন", en: "This division has no fail mark of its own, so separate grades cannot be added. Set the division's fail mark first" }),
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
      return friendlyFailure("getFailMark error:", err, t({ bn: "ফেল মার্ক লোড করা যায়নি", en: "Failed to load fail mark" }));
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
      return friendlyFailure("getEffectiveFailMark error:", err, t({ bn: "ফেল মার্ক লোড করা যায়নি", en: "Failed to load fail mark" }));
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
          name: linkName(row, row.division) ?? "",
          fail_mark: row.failMark ?? null,
          has_custom_grades: withGrades.has(row.divisionId),
        })),
      };
    } catch (err) {
      return friendlyFailure("listDivisionFailMarks error:", err, t({ bn: "বিভাগের ফেল মার্ক লোড করা যায়নি", en: "Failed to load division fail marks" }));
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
    if (dto.value === undefined) throw new BadRequestError(t({ bn: "মান আবশ্যক", en: "Value is required" }));
    const failValue = dto.value === null ? null : parseFailMarkValue(dto.value);
    if (failValue !== null && !Number.isInteger(failValue)) {
      throw new BadRequestError(t({ bn: "ফেল মার্ক অবশ্যই 0 থেকে 100 এর মধ্যে একটি পূর্ণসংখ্যা হতে হবে", en: "Fail mark must be a whole number between 0 and 100" }));
    }

    const division = await this.repository.findActiveDivision(madrasaId, divisionId);
    if (!division) throw new NotFoundError(t({ bn: "বিভাগ পাওয়া যায়নি", en: "Division not found" }));

    try {
      if (failValue === null) {
        await this.repository.clearDivisionOverride(madrasaId, divisionId);
      } else {
        await this.repository.setDivisionFailMark(madrasaId, divisionId, failValue);
        await this.ensureDivisionGradeScales(madrasaId, divisionId);
        await this.repinLowestGradeBands(madrasaId, failValue, divisionId);
      }
    } catch (err) {
      return friendlyFailure("updateDivisionFailMark error:", err, t({ bn: "বিভাগের ফেল মার্ক আপডেট করা যায়নি", en: "Failed to update division fail mark" }));
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
      return friendlyFailure("updateFailMark error:", err, t({ bn: "ফেল মার্ক আপডেট করা যায়নি", en: "Failed to update fail mark" }));
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
