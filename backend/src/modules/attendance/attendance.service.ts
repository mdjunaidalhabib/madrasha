import type { Attendance, AttendanceStatus, AttendeeType } from "@prisma/client";
import { BadRequestError, NotFoundError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants/http-status";
import { logger } from "../../shared/logger/logger";
import { ApiError } from "../../shared/errors";
import { attendanceRepository, AttendanceRepository } from "./attendance.repository";
import {
  AttendanceCalendarQueryDto,
  AttendanceHistoryQueryDto,
  AttendanceQueryDto,
  AttendanceStatsQueryDto,
  AttendanceSummaryQueryDto,
  BulkMarkAttendanceRequestDto,
  BulkMarkResult,
  CorrectAttendanceRequestDto,
} from "./attendance.dto";
import { ATTENDEE_TYPES, ATTENDANCE_STATUSES } from "./attendance.constants";
import {
  assertMarkDateAllowed,
  BulkEntryInput,
  classifyMarkDate,
  correctionNeedsEdit,
  MarkRuleViolation,
  parsePolicyInput,
  planBulkMark,
  PolicyInput,
} from "./attendance.rules";
import { attendanceCalendar, dateOnly, isValidDateString, monthBounds, todayLocal } from "./core/attendance-calendar";
import { getPolicy, attendancePolicyRepository, toPolicyDto } from "./core/attendance-policy";
import { AttendanceChangeInput, listAttendanceChanges, recordAttendanceChanges } from "./core/attendance-audit";
import { statsForAttendee, statsForAttendees } from "./core/attendance-stats";
import { t } from "../../shared/i18n";

const friendlyFailure = (logTag: string, err: unknown, friendlyMessage: string): never => {
  if (err instanceof ApiError) throw err;
  logger.error(logTag, err);
  throw new ApiError(friendlyMessage, 500);
};

/** Longest range /calendar and /stats accept (a bit over a year). */
const MAX_RANGE_DAYS = 400;
const MAX_STATS_ATTENDEES = 5000;

/** Who is acting. `canEdit` is lazy: the attendance.edit lookup only runs when a rule needs it. */
export interface AttendanceActor {
  userId: number | null;
  canEdit: () => Promise<boolean>;
}

const parseDateOnly = (value: string | undefined, label: string): Date => {
  if (!value) throw new BadRequestError(t({ bn: `${label} আবশ্যক`, en: `${label} is required` }));
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestError(t({ bn: `${label} সঠিক নয়`, en: `${label} is invalid` }));
  return date;
};

/** Strict "YYYY-MM-DD" (an ISO timestamp is cut to its date part). */
const parseDay = (value: unknown, label: string): string => {
  if (value === undefined || value === null || value === "") {
    throw new BadRequestError(t({ bn: `${label} আবশ্যক`, en: `${label} is required` }));
  }
  const s = String(value).slice(0, 10);
  if (!isValidDateString(s)) {
    throw new BadRequestError(t({ bn: `${label} অবশ্যই YYYY-MM-DD ফরম্যাটে হতে হবে`, en: `${label} must be in YYYY-MM-DD format` }));
  }
  return s;
};

const parseAttendeeType = (value: unknown): AttendeeType => {
  const attendeeType = String(value || "").toUpperCase();
  if (!ATTENDEE_TYPES.includes(attendeeType as any)) {
    throw new BadRequestError(t({ bn: "attendee_type অবশ্যই STUDENT, TEACHER অথবা STAFF হতে হবে", en: "attendee_type must be STUDENT, TEACHER or STAFF" }));
  }
  return attendeeType as AttendeeType;
};

const parseStatus = (value: unknown, attendeeId?: unknown): AttendanceStatus => {
  const status = String(value || "").toUpperCase();
  if (!ATTENDANCE_STATUSES.includes(status as any)) {
    throw new BadRequestError(
      attendeeId !== undefined
        ? t({ bn: `হাজিরাদাতা ${attendeeId}-এর জন্য "${value}" স্ট্যাটাসটি সঠিক নয়`, en: `Invalid status "${value}" for attendee ${attendeeId}` })
        : t({ bn: `"${value}" স্ট্যাটাসটি সঠিক নয়`, en: `Invalid status "${value}"` }),
    );
  }
  return status as AttendanceStatus;
};

const parsePositiveInt = (value: unknown, label: string): number => {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new BadRequestError(t({ bn: `${label} সঠিক নয়`, en: `${label} is invalid` }));
  return n;
};

const cleanReason = (value: unknown): string | null => {
  const s = typeof value === "string" ? value.trim() : "";
  return s ? s.slice(0, 255) : null;
};

const cleanRemarks = (value: unknown): string | null => {
  const s = typeof value === "string" ? value.trim() : "";
  return s ? s.slice(0, 255) : null;
};

/** `month` or `from`+`to` -> inclusive range (default: the current local month). */
const resolveRange = (query: { month?: string; from?: string; to?: string }) => {
  if (query.from || query.to) {
    const from = parseDay(query.from, "from");
    const to = parseDay(query.to, "to");
    if (from > to) throw new BadRequestError(t({ bn: "from অবশ্যই to এর আগে হতে হবে", en: "from must not be after to" }));
    return { month: undefined as string | undefined, from, to };
  }
  const month = query.month || todayLocal().slice(0, 7);
  const bounds = monthBounds(month);
  if (!bounds) throw new BadRequestError(t({ bn: "month অবশ্যই YYYY-MM ফরম্যাটে হতে হবে", en: "month must be in YYYY-MM format" }));
  return { month, ...bounds };
};

const assertRangeSize = (from: string, to: string) => {
  const days = (dateOnly(to).getTime() - dateOnly(from).getTime()) / 86_400_000 + 1;
  if (days > MAX_RANGE_DAYS) {
    throw new BadRequestError(t({ bn: `তারিখের সীমা ${MAX_RANGE_DAYS} দিনের বেশি হতে পারবে না`, en: `Date range cannot exceed ${MAX_RANGE_DAYS} days` }));
  }
};

/** Rule violation -> HTTP error with `errors.code` for the UI. */
const ruleError = (err: MarkRuleViolation, editWindowDays: number): ApiError => {
  switch (err.code) {
    case "future_date":
      return new BadRequestError(t({ bn: "ভবিষ্যতের তারিখে হাজিরা নেওয়া যাবে না", en: "Attendance cannot be marked for a future date" }), { code: "future_date" });
    case "edit_permission_required":
      return new ApiError(
        t({
          bn: `${editWindowDays} দিনের বেশি পুরনো হাজিরা পরিবর্তনের অনুমতি আপনার নেই`,
          en: `You are not allowed to change attendance older than ${editWindowDays} days`,
        }),
        HttpStatus.FORBIDDEN,
        { code: "edit_permission_required" },
      );
    case "reason_required":
      return new BadRequestError(t({ bn: "পূর্বের হাজিরা পরিবর্তনের কারণ লিখুন", en: "A reason is required to change past attendance" }), { code: "reason_required" });
  }
};

const offDayError = (reason: string, title: string | null) =>
  new BadRequestError(
    reason === "holiday"
      ? t({ bn: `এই দিনটি ছুটির দিন${title ? ` (${title})` : ""} - হাজিরা নেওয়া যাবে না`, en: `This day is a holiday${title ? ` (${title})` : ""} - attendance cannot be marked` })
      : t({ bn: "এই দিনটি সাপ্তাহিক ছুটি - হাজিরা নেওয়া যাবে না", en: "This day is a weekly off day - attendance cannot be marked" }),
    { code: "off_day", reason, title },
  );

export class AttendanceService {
  constructor(private readonly repository: AttendanceRepository = attendanceRepository) {}

  /**
   * Marks a whole class/day. Enforces the v3 rules (future date, edit
   * window, off day, protected device/leave rows, reason for past changes),
   * leaves unchanged rows untouched and audits every create/change in the
   * same transaction.
   */
  async bulkMark(madrasaId: number, actor: AttendanceActor, dto: BulkMarkAttendanceRequestDto): Promise<BulkMarkResult> {
    const attendeeType = parseAttendeeType(dto.attendee_type);
    const date = parseDay(dto.date, "date");

    if (!Array.isArray(dto.entries) || dto.entries.length === 0) {
      throw new BadRequestError(t({ bn: "entries একটি খালি নয় এমন তালিকা হতে হবে", en: "entries must be a non-empty array" }));
    }

    const classId = dto.class_id ? Number(dto.class_id) : null;
    const entries: BulkEntryInput[] = dto.entries.map((entry) => {
      if (entry.attendee_id === undefined || entry.attendee_id === null || !Number.isInteger(Number(entry.attendee_id))) {
        throw new BadRequestError(t({ bn: "প্রতিটি এন্ট্রির জন্য attendee_id আবশ্যক", en: "attendee_id is required for every entry" }));
      }
      return {
        attendeeId: Number(entry.attendee_id),
        status: parseStatus(entry.status, entry.attendee_id),
        remarks: cleanRemarks(entry.remarks),
      };
    });

    const reason = cleanReason(dto.reason);
    const overrideProtected = dto.override_protected === true || dto.override_protected === "true";
    const policy = await getPolicy(madrasaId);
    const today = todayLocal();
    const kind = classifyMarkDate(date, today, policy.editWindowDays);
    // Only look the permission up when a rule actually depends on it.
    const canEdit = kind === "outside_window" || overrideProtected ? await actor.canEdit() : false;

    try {
      assertMarkDateAllowed(kind, canEdit);
    } catch (err) {
      if (err instanceof MarkRuleViolation) throw ruleError(err, policy.editWindowDays);
      throw err;
    }

    const off = await attendanceCalendar.offDay(madrasaId, date);
    if (off) throw offDayError(off.reason, off.title);

    const day = dateOnly(date);
    try {
      return await this.repository.transaction(async (tx) => {
        const existing = await this.repository.findForDate(
          tx,
          madrasaId,
          attendeeType,
          [...new Set(entries.map((e) => e.attendeeId))],
          day,
        );
        const plan = planBulkMark(entries, existing, { isPast: date < today, canEdit, overrideProtected, reason });

        const audit: AttendanceChangeInput[] = [];
        const base = { madrasaId, attendeeType, date: day, reason, via: "manual" as const, changedById: actor.userId };

        for (const entry of plan.creates) {
          const row = await this.repository.create(tx, {
            madrasaId,
            attendeeType,
            attendeeId: entry.attendeeId,
            classId,
            date: day,
            status: entry.status,
            remarks: entry.remarks,
            markedById: actor.userId,
            source: "manual",
          });
          audit.push({ ...base, attendanceId: row.id, attendeeId: entry.attendeeId, oldStatus: null, newStatus: entry.status, oldSource: null, newSource: "manual" });
        }

        for (const { entry, existing: row } of plan.updates) {
          await this.repository.update(tx, row.id, {
            status: entry.status,
            remarks: entry.remarks,
            markedById: actor.userId,
            source: "manual",
            ...(classId ? { classId } : {}),
          });
          audit.push({
            ...base,
            attendanceId: row.id,
            attendeeId: entry.attendeeId,
            oldStatus: row.status,
            newStatus: entry.status,
            oldSource: row.source,
            newSource: "manual",
          });
        }

        for (const { entry, existing: row } of plan.remarkUpdates) {
          await this.repository.update(tx, row.id, { remarks: entry.remarks });
        }

        await recordAttendanceChanges(tx, audit);

        const created = plan.creates.length;
        const updated = plan.updates.length + plan.remarkUpdates.length;
        return { savedCount: created + updated, created, updated, unchanged: plan.unchanged, skipped: plan.skipped };
      });
    } catch (err) {
      if (err instanceof MarkRuleViolation) throw ruleError(err, policy.editWindowDays);
      return friendlyFailure("bulkMarkAttendance error:", err, t({ bn: "হাজিরা সংরক্ষণ করা যায়নি", en: "Failed to save attendance" }));
    }
  }

  /** PATCH /:id - corrects one row with a mandatory reason (audited via "correction"). */
  async correct(madrasaId: number, actor: AttendanceActor, id: number, dto: CorrectAttendanceRequestDto): Promise<Attendance> {
    const status = parseStatus(dto?.status);
    const reason = cleanReason(dto?.reason);
    if (!reason) {
      throw new BadRequestError(t({ bn: "সংশোধনের কারণ লিখুন", en: "A reason is required for a correction" }), { code: "reason_required" });
    }

    const row = await this.repository.findById(madrasaId, id);
    if (!row) throw new NotFoundError(t({ bn: "হাজিরা পাওয়া যায়নি", en: "Attendance record not found" }));

    const policy = await getPolicy(madrasaId);
    const date = row.date.toISOString().slice(0, 10);
    const kind = classifyMarkDate(date, todayLocal(), policy.editWindowDays);
    if (kind === "future") throw ruleError(new MarkRuleViolation("future_date"), policy.editWindowDays);
    if (correctionNeedsEdit(kind, row.source) && !(await actor.canEdit())) {
      if (kind === "outside_window") throw ruleError(new MarkRuleViolation("edit_permission_required"), policy.editWindowDays);
      throw new ApiError(
        t({ bn: "ডিভাইস/ছুটির হাজিরা পরিবর্তনের অনুমতি আপনার নেই", en: "You are not allowed to change device or leave attendance" }),
        HttpStatus.FORBIDDEN,
        { code: "edit_permission_required" },
      );
    }

    const remarks = dto.remarks === undefined ? row.remarks : cleanRemarks(dto.remarks);
    if (status === row.status && remarks === row.remarks) return row;

    try {
      return await this.repository.transaction(async (tx) => {
        const updated = await this.repository.update(tx, row.id, {
          status,
          remarks,
          markedById: actor.userId,
          source: "manual",
        });
        await recordAttendanceChanges(tx, [
          {
            madrasaId,
            attendanceId: row.id,
            attendeeType: row.attendeeType,
            attendeeId: row.attendeeId,
            date: row.date,
            oldStatus: row.status,
            newStatus: status,
            oldSource: row.source,
            newSource: "manual",
            reason,
            via: "correction",
            changedById: actor.userId,
          },
        ]);
        return updated;
      });
    } catch (err) {
      return friendlyFailure("correctAttendance error:", err, t({ bn: "হাজিরা সংশোধন করা যায়নি", en: "Failed to correct attendance" }));
    }
  }

  async list(madrasaId: number, query: AttendanceQueryDto) {
    const where: Record<string, unknown> = {};

    if (query.class_id) where.classId = Number(query.class_id);
    if (query.attendee_type) where.attendeeType = String(query.attendee_type).toUpperCase();
    if (query.attendee_id) where.attendeeId = Number(query.attendee_id);

    if (query.date) {
      where.date = parseDateOnly(query.date, "date");
    } else if (query.from || query.to) {
      where.date = {
        ...(query.from ? { gte: parseDateOnly(query.from, "from") } : {}),
        ...(query.to ? { lte: parseDateOnly(query.to, "to") } : {}),
      };
    }

    try {
      return await this.repository.findMany(madrasaId, where as any);
    } catch (err) {
      return friendlyFailure("listAttendance error:", err, t({ bn: "হাজিরা লোড করা যায়নি", en: "Failed to load attendance" }));
    }
  }

  /**
   * One attendee's counts + working-day percentage for a month (or
   * from/to). `total` = recorded rows (kept for old callers).
   */
  async summary(madrasaId: number, query: AttendanceSummaryQueryDto) {
    if (!query.attendee_id) throw new BadRequestError(t({ bn: "attendee_id আবশ্যক", en: "attendee_id is required" }));
    const attendeeType = parseAttendeeType(query.attendee_type);
    const attendeeId = parsePositiveInt(query.attendee_id, "attendee_id");
    const { month, from, to } = resolveRange(query);
    assertRangeSize(from, to);

    try {
      const stats = await statsForAttendee(madrasaId, attendeeType, attendeeId, from, to);
      const total = stats.PRESENT + stats.LATE + stats.ABSENT + stats.LEAVE;
      return { ...(month ? { month } : {}), from, to, ...stats, total };
    } catch (err) {
      return friendlyFailure("attendanceSummary error:", err, t({ bn: "হাজিরার সারাংশ লোড করা যায়নি", en: "Failed to load attendance summary" }));
    }
  }

  /** Bulk stats: explicit ids, a class's active students, or everybody of the type with records. */
  async stats(madrasaId: number, query: AttendanceStatsQueryDto) {
    const attendeeType = parseAttendeeType(query.attendee_type);
    const { from, to } = resolveRange(query);
    assertRangeSize(from, to);

    let ids: number[];
    if (query.attendee_ids) {
      ids = [...new Set(String(query.attendee_ids).split(",").map((s) => s.trim()).filter(Boolean).map((s) => parsePositiveInt(s, "attendee_ids")))];
    } else if (query.class_id && attendeeType === "STUDENT") {
      ids = await this.repository.activeStudentIdsOfClass(madrasaId, parsePositiveInt(query.class_id, "class_id"));
    } else {
      ids = await this.repository.attendeeIdsWithRecords(madrasaId, attendeeType);
    }
    if (ids.length > MAX_STATS_ATTENDEES) {
      throw new BadRequestError(t({ bn: `একসাথে সর্বোচ্চ ${MAX_STATS_ATTENDEES} জনের হিসাব করা যায়`, en: `At most ${MAX_STATS_ATTENDEES} attendees per request` }));
    }

    try {
      const byId = await statsForAttendees(madrasaId, attendeeType, ids, from, to);
      return ids.map((id) => ({ attendee_id: id, ...byId.get(id)! }));
    } catch (err) {
      return friendlyFailure("attendanceStats error:", err, t({ bn: "হাজিরার পরিসংখ্যান লোড করা যায়নি", en: "Failed to load attendance statistics" }));
    }
  }

  async history(madrasaId: number, query: AttendanceHistoryQueryDto) {
    const attendeeType = parseAttendeeType(query.attendee_type);
    const attendeeId = parsePositiveInt(query.attendee_id, "attendee_id");
    const date = query.date ? dateOnly(parseDay(query.date, "date")) : undefined;
    return listAttendanceChanges(madrasaId, {
      attendeeType,
      attendeeId,
      date,
      limit: query.limit ? Number(query.limit) || undefined : undefined,
    });
  }

  /** History of one row. Not 404 for a deleted row - the audit trail outlives it. */
  async rowHistory(madrasaId: number, id: number) {
    return listAttendanceChanges(madrasaId, { attendanceId: id });
  }

  /** What the mark screen needs to know about a date before showing it. */
  async dayInfo(madrasaId: number, actor: AttendanceActor, dateParam?: string) {
    const today = todayLocal();
    const date = dateParam ? parseDay(dateParam, "date") : today;
    const [policy, off, canEditPast] = await Promise.all([
      getPolicy(madrasaId),
      attendanceCalendar.offDay(madrasaId, date),
      actor.canEdit(),
    ]);
    const kind = classifyMarkDate(date, today, policy.editWindowDays);
    return {
      date,
      today,
      off: !!off,
      reason: off?.reason ?? null,
      title: off?.title ?? null,
      is_future: kind === "future",
      within_window: kind === "today" || kind === "within_window",
      can_edit_past: canEditPast,
      edit_window_days: policy.editWindowDays,
    };
  }

  async calendar(madrasaId: number, query: AttendanceCalendarQueryDto) {
    const { from, to } = resolveRange(query);
    assertRangeSize(from, to);
    const range = await attendanceCalendar.range(madrasaId, from, to);
    return { working_days: range.workingDays, off_days: range.offDays };
  }

  async getPolicy(madrasaId: number) {
    return toPolicyDto(await getPolicy(madrasaId));
  }

  async updatePolicy(madrasaId: number, body: PolicyInput) {
    const parsed = parsePolicyInput(body ?? {});
    if (!parsed.ok) {
      throw new BadRequestError(t({ bn: parsed.error.bn, en: parsed.error.en }), { field: parsed.error.field });
    }
    const current = await getPolicy(madrasaId);
    const next = { ...current, ...parsed.patch };
    await attendancePolicyRepository.upsert(madrasaId, {
      editWindowDays: next.editWindowDays,
      lateToAbsentCount: next.lateToAbsentCount,
      leaveMode: next.leaveMode,
      lowAttendancePercent: next.lowAttendancePercent,
      consecutiveAbsentDays: next.consecutiveAbsentDays,
      payrollDeductAbsent: next.payrollDeductAbsent,
    });
    return toPolicyDto(next);
  }
}

export const attendanceService = new AttendanceService();
