import type { AttendanceStatus } from "@prisma/client";
import { addDays } from "./core/attendance-calendar";

/**
 * Pure server-side rules of manual marking (POST /bulk, PATCH /:id). No DB
 * or clock access here so they can be unit tested; the service loads the
 * existing rows/policy/permission and turns a rule violation into the
 * matching HTTP error.
 */

/** Sources a plain re-mark must never silently overwrite. */
export const PROTECTED_SOURCES = ["k40", "leave"] as const;
export const isProtectedSource = (source: string | null | undefined) =>
  PROTECTED_SOURCES.includes(String(source) as (typeof PROTECTED_SOURCES)[number]);

/** Error codes returned in `errors.code` (see ATTENDANCE_V3_API.md). */
export type MarkRuleCode = "future_date" | "edit_permission_required" | "reason_required";

export class MarkRuleViolation extends Error {
  constructor(public readonly code: MarkRuleCode) {
    super(code);
  }
}

export type MarkDateKind = "future" | "today" | "within_window" | "outside_window";

/** Where `date` sits relative to today and the edit window (all YYYY-MM-DD). */
export const classifyMarkDate = (date: string, today: string, editWindowDays: number): MarkDateKind => {
  if (date > today) return "future";
  if (date === today) return "today";
  return date >= addDays(today, -Math.max(0, editWindowDays)) ? "within_window" : "outside_window";
};

/** Throws for a future date, or an out-of-window date without attendance.edit. */
export const assertMarkDateAllowed = (kind: MarkDateKind, canEdit: boolean) => {
  if (kind === "future") throw new MarkRuleViolation("future_date");
  if (kind === "outside_window" && !canEdit) throw new MarkRuleViolation("edit_permission_required");
};

export interface BulkEntryInput {
  attendeeId: number;
  status: AttendanceStatus;
  remarks: string | null;
}

export interface ExistingRow {
  id: number;
  attendeeId: number;
  status: AttendanceStatus;
  source: string;
  remarks: string | null;
}

export interface BulkPlanOptions {
  /** date < today (a reason is needed to change an existing row). */
  isPast: boolean;
  canEdit: boolean;
  overrideProtected: boolean;
  reason: string | null;
}

export interface BulkPlan {
  creates: BulkEntryInput[];
  /** Status changes (audited). */
  updates: Array<{ entry: BulkEntryInput; existing: ExistingRow }>;
  /** Same status, only the remarks differ: remarks written, source/markedBy kept, not audited. */
  remarkUpdates: Array<{ entry: BulkEntryInput; existing: ExistingRow }>;
  unchanged: number;
  skipped: Array<{ attendee_id: number; source: string }>;
}

/**
 * Decides what a bulk mark does with every entry. Duplicate attendee ids:
 * the last entry wins. Throws `reason_required` when a past row's status
 * would change without a reason.
 */
export const planBulkMark = (
  entries: BulkEntryInput[],
  existingRows: ExistingRow[],
  opts: BulkPlanOptions,
): BulkPlan => {
  const byAttendee = new Map<number, BulkEntryInput>();
  for (const e of entries) byAttendee.set(e.attendeeId, e);
  const existingById = new Map(existingRows.map((r) => [r.attendeeId, r]));
  const canOverride = opts.overrideProtected && opts.canEdit && !!opts.reason;

  const plan: BulkPlan = { creates: [], updates: [], remarkUpdates: [], unchanged: 0, skipped: [] };
  for (const entry of byAttendee.values()) {
    const existing = existingById.get(entry.attendeeId);
    if (!existing) {
      plan.creates.push(entry);
      continue;
    }
    if (existing.status === entry.status) {
      // A device/leave row's remarks are left alone too - they explain the row.
      if (entry.remarks !== null && entry.remarks !== existing.remarks && !isProtectedSource(existing.source)) {
        plan.remarkUpdates.push({ entry, existing });
      } else plan.unchanged++;
      continue;
    }
    if (isProtectedSource(existing.source) && !canOverride) {
      plan.skipped.push({ attendee_id: entry.attendeeId, source: existing.source });
      continue;
    }
    if (opts.isPast && !opts.reason) throw new MarkRuleViolation("reason_required");
    plan.updates.push({ entry, existing });
  }
  return plan;
};

/** PATCH /:id: which permission a correction of `row` needs on top of attendance.mark. */
export const correctionNeedsEdit = (kind: MarkDateKind, source: string) =>
  kind === "outside_window" || isProtectedSource(source);

export interface PolicyInput {
  edit_window_days?: unknown;
  late_to_absent_count?: unknown;
  leave_mode?: unknown;
  low_attendance_percent?: unknown;
  consecutive_absent_days?: unknown;
  payroll_deduct_absent?: unknown;
}

/** One validation failure of PUT /policy: field + bilingual message parts. */
export interface PolicyFieldError {
  field: keyof PolicyInput;
  bn: string;
  en: string;
}

const intIn = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n >= min && n <= max ? n : null;
};

const toBool = (v: unknown): boolean | null => {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === 1 || v === "1") return true;
  if (v === "false" || v === 0 || v === "0") return false;
  return null;
};

/**
 * Validates a (partial) PUT /policy body. Returns the camelCase patch or the
 * first error. Unknown keys are ignored; absent keys are left unchanged.
 */
export const parsePolicyInput = (
  body: PolicyInput,
):
  | { ok: true; patch: Partial<{
      editWindowDays: number;
      lateToAbsentCount: number;
      leaveMode: "excluded" | "present" | "absent";
      lowAttendancePercent: number;
      consecutiveAbsentDays: number;
      payrollDeductAbsent: boolean;
    }> }
  | { ok: false; error: PolicyFieldError } => {
  const patch: Record<string, unknown> = {};
  const fail = (field: keyof PolicyInput, bn: string, en: string) => ({ ok: false as const, error: { field, bn, en } });

  if (body.edit_window_days !== undefined) {
    const n = intIn(body.edit_window_days, 0, 365);
    if (n === null) return fail("edit_window_days", "edit_window_days অবশ্যই 0 থেকে 365 এর মধ্যে হতে হবে", "edit_window_days must be between 0 and 365");
    patch.editWindowDays = n;
  }
  if (body.late_to_absent_count !== undefined) {
    const n = intIn(body.late_to_absent_count, 0, 31);
    if (n === null) return fail("late_to_absent_count", "late_to_absent_count অবশ্যই 0 থেকে 31 এর মধ্যে হতে হবে", "late_to_absent_count must be between 0 and 31");
    patch.lateToAbsentCount = n;
  }
  if (body.leave_mode !== undefined) {
    const m = String(body.leave_mode);
    if (m !== "excluded" && m !== "present" && m !== "absent") {
      return fail("leave_mode", "leave_mode অবশ্যই excluded, present অথবা absent হতে হবে", "leave_mode must be excluded, present or absent");
    }
    patch.leaveMode = m;
  }
  if (body.low_attendance_percent !== undefined) {
    const n = intIn(body.low_attendance_percent, 0, 100);
    if (n === null) return fail("low_attendance_percent", "low_attendance_percent অবশ্যই 0 থেকে 100 এর মধ্যে হতে হবে", "low_attendance_percent must be between 0 and 100");
    patch.lowAttendancePercent = n;
  }
  if (body.consecutive_absent_days !== undefined) {
    const n = intIn(body.consecutive_absent_days, 0, 30);
    if (n === null || n === 1) {
      return fail("consecutive_absent_days", "consecutive_absent_days অবশ্যই 0 (বন্ধ) অথবা 2 থেকে 30 এর মধ্যে হতে হবে", "consecutive_absent_days must be 0 (off) or between 2 and 30");
    }
    patch.consecutiveAbsentDays = n;
  }
  if (body.payroll_deduct_absent !== undefined) {
    const b = toBool(body.payroll_deduct_absent);
    if (b === null) return fail("payroll_deduct_absent", "payroll_deduct_absent অবশ্যই true অথবা false হতে হবে", "payroll_deduct_absent must be true or false");
    patch.payrollDeductAbsent = b;
  }
  return { ok: true, patch };
};
