import type { AttendanceStatus } from "@prisma/client";
import { LEAVE_ATTENDANCE_SOURCE } from "./attendance-leave.constants";

/**
 * Pure decisions of the leave workflow and the consecutive-absence alert
 * (no DB access - unit tested in __tests__/attendance-leave.rules.test.ts).
 */

export interface ExistingRow {
  id: number;
  /** YYYY-MM-DD */
  date: string;
  status: AttendanceStatus;
  source: string;
}

export interface ApprovalPlan {
  /** Working days without a row -> create LEAVE. */
  create: string[];
  /** ABSENT rows (any source) -> LEAVE. */
  convert: ExistingRow[];
  /** PRESENT / LATE / LEAVE rows: the person came (or is already on leave) - untouched. */
  skipped: ExistingRow[];
}

/** Which working days of an approved leave get LEAVE. */
export const planLeaveApproval = (workingDays: string[], existing: ExistingRow[]): ApprovalPlan => {
  const byDate = new Map(existing.map((r) => [r.date, r]));
  const plan: ApprovalPlan = { create: [], convert: [], skipped: [] };
  for (const date of workingDays) {
    const row = byDate.get(date);
    if (!row) plan.create.push(date);
    else if (row.status === "ABSENT") plan.convert.push(row);
    else plan.skipped.push(row);
  }
  return plan;
};

/** Rows a cancel / reject of an APPROVED leave removes: only LEAVE rows the leave itself wrote. */
export const planLeaveRemoval = (rows: ExistingRow[], from: string, to: string): ExistingRow[] =>
  rows.filter((r) => r.source === LEAVE_ATTENDANCE_SOURCE && r.status === "LEAVE" && r.date >= from && r.date <= to);

/** Inclusive number of calendar days of [from, to]. */
export const calendarDays = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;

export type RangeError = "from_after_to" | "too_long" | "too_early";

/**
 * Date range check of a new leave request. `earliest` = the first allowed
 * from_date (guardian: today - 3 days), null = no limit (admin).
 */
export const checkLeaveRange = (
  from: string,
  to: string,
  maxDays: number,
  earliest: string | null,
): RangeError | null => {
  if (from > to) return "from_after_to";
  if (calendarDays(from, to) > maxDays) return "too_long";
  if (earliest && from < earliest) return "too_early";
  return null;
};

export interface Streak {
  /** Number of consecutive taken working days with an ABSENT row, newest first. */
  streak: number;
  /** First (oldest) date of the streak, null when streak = 0. */
  since: string | null;
}

/**
 * Consecutive-absence streak of one person ending at the newest taken day.
 * `takenDaysDesc` = working days on which attendance was taken (newest first);
 * a day counts only with an explicit ABSENT row - PRESENT / LATE / LEAVE or
 * no row at all (e.g. not yet admitted) ends the streak.
 */
export const absenceStreak = (takenDaysDesc: string[], statusByDate: Map<string, AttendanceStatus>): Streak => {
  let streak = 0;
  let since: string | null = null;
  for (const date of takenDaysDesc) {
    if (statusByDate.get(date) !== "ABSENT") break;
    streak++;
    since = date;
  }
  return { streak, since };
};

/**
 * One alert per streak: alert when the streak reached the threshold and no
 * alert was queued for this student on/after the streak's first day.
 */
export const shouldAlert = (s: Streak, threshold: number, lastAlertDate: string | null): boolean =>
  threshold >= 2 && s.streak >= threshold && !!s.since && !(lastAlertDate && lastAlertDate >= s.since);
