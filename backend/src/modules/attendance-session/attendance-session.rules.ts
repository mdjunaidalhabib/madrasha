import { addDays } from "../attendance/core/attendance-calendar";
import type { Policy } from "../attendance/core/attendance-policy";
import { computeStats, StatusCounts } from "../attendance/core/attendance-stats";

/** Pure helpers of the session module (unit-tested). */

export const SESSION_STATUSES = ["PRESENT", "ABSENT", "LATE", "LEAVE"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

/** Student.residencyType value of residential (আবাসিক) students. */
export const RESIDENTIAL = 1;

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const isHm = (value: string): boolean => HH_MM.test(value);

/** true/false from JSON booleans, "1"/"0", "true"/"false"; undefined when absent. */
export const parseBool = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  const s = String(value).trim().toLowerCase();
  if (s === "1" || s === "true" || s === "yes") return true;
  if (s === "0" || s === "false" || s === "no") return false;
  return undefined;
};

export type MarkDateProblem = "future_date" | "outside_window" | null;

/**
 * Same date rule as the manual bulk mark: never a future date; dates older
 * than today - editWindowDays need attendance.edit (caller decides).
 */
export const markDateProblem = (date: string, today: string, editWindowDays: number): MarkDateProblem => {
  if (date > today) return "future_date";
  if (date < addDays(today, -Math.max(0, editWindowDays))) return "outside_window";
  return null;
};

export const emptyCounts = (): StatusCounts => ({ PRESENT: 0, LATE: 0, ABSENT: 0, LEAVE: 0 });

/**
 * Session percentage: only marked slots count (a session is not taken on
 * every day), with the madrasa policy's late / leave rules applied through
 * the shared formula.
 */
export const sessionPercentage = (
  counts: StatusCounts,
  policy: Pick<Policy, "lateToAbsentCount" | "leaveMode">,
): { total: number; percentage: number } => {
  const total = counts.PRESENT + counts.LATE + counts.ABSENT + counts.LEAVE;
  return { total, percentage: computeStats(counts, total, policy).percentage };
};

export const addCounts = (a: StatusCounts, b: StatusCounts): StatusCounts => ({
  PRESENT: a.PRESENT + b.PRESENT,
  LATE: a.LATE + b.LATE,
  ABSENT: a.ABSENT + b.ABSENT,
  LEAVE: a.LEAVE + b.LEAVE,
});
