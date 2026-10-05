import type { AttendanceStatus } from "@prisma/client";
import { localMinutesOfDay } from "../attendance-device/attendance-device-rules";
import type { LeaveMode } from "../attendance/core/attendance-policy";

/** Pure helpers of the analytics module (unit-tested). */

export interface Totals {
  total: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
  unmarked: number;
  /** (present + late) / marked %, or / total when nothing is marked; one decimal. */
  rate: number;
}

export const round1 = (n: number): number => Math.round(n * 10) / 10;
export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Attendance rate: (present + late) over the marked rows, falling back to the population. */
export const attendanceRate = (present: number, late: number, marked: number, total: number): number => {
  const denom = marked > 0 ? marked : total;
  return denom > 0 ? Math.min(100, round1(((present + late) / denom) * 100)) : 0;
};

export const emptyTotals = (total = 0): Totals => ({
  total,
  present: 0,
  late: 0,
  absent: 0,
  leave: 0,
  unmarked: total,
  rate: 0,
});

/** Adds one status to running totals (call finalizeTotals afterwards). */
export const addStatus = (t: Totals, status: AttendanceStatus | string, n = 1): void => {
  if (status === "PRESENT") t.present += n;
  else if (status === "LATE") t.late += n;
  else if (status === "ABSENT") t.absent += n;
  else if (status === "LEAVE") t.leave += n;
};

/** Recomputes `unmarked` and `rate` from the counts and the population size. */
export const finalizeTotals = (t: Totals): Totals => {
  const marked = t.present + t.late + t.absent + t.leave;
  t.unmarked = Math.max(0, t.total - marked);
  t.rate = attendanceRate(t.present, t.late, marked, t.total);
  return t;
};

/** Totals of a population given its status per person (people without a row are unmarked). */
export const totalsFor = (populationIds: number[], statusById: Map<number, AttendanceStatus | string>): Totals => {
  const t = emptyTotals(populationIds.length);
  for (const id of populationIds) {
    const s = statusById.get(id);
    if (s) addStatus(t, s);
  }
  return finalizeTotals(t);
};

export interface TrendPoint {
  date: string;
  off: boolean;
  present: number;
  late: number;
  absent: number;
  leave: number;
  total: number;
  rate: number;
}

/**
 * Buckets grouped (date, status, count) rows into one point per date.
 * `total` = population size (same for every day); off days are flagged.
 */
export const bucketTrend = (
  dates: string[],
  offDates: Set<string>,
  grouped: Array<{ date: string; status: AttendanceStatus | string; count: number }>,
  population: number,
): TrendPoint[] => {
  const byDate = new Map<string, Totals>();
  for (const d of dates) byDate.set(d, emptyTotals(population));
  for (const g of grouped) {
    const t = byDate.get(g.date);
    if (t) addStatus(t, g.status, g.count);
  }
  return dates.map((date) => {
    const t = finalizeTotals(byDate.get(date)!);
    return {
      date,
      off: offDates.has(date),
      present: t.present,
      late: t.late,
      absent: t.absent,
      leave: t.leave,
      total: t.total,
      rate: t.rate,
    };
  });
};

/** Salary / working days of the month (0 when either is missing). */
export const perDaySalary = (salary: number | null, workingDays: number): number =>
  salary && salary > 0 && workingDays > 0 ? round2(salary / workingDays) : 0;

/** Absent-equivalent days the suggestion deducts for. */
export const deductibleDays = (
  s: { ABSENT: number; LEAVE: number; unmarked: number; late_penalty: number },
  leaveMode: LeaveMode,
): number => s.ABSENT + s.unmarked + s.late_penalty + (leaveMode === "absent" ? s.LEAVE : 0);

/** Suggested deduction = per-day salary x deductible days, capped at the salary; 0 when the policy disables it. */
export const suggestedDeduction = (
  salary: number | null,
  workingDays: number,
  days: number,
  deductAbsent: boolean,
): number => {
  if (!deductAbsent || !salary || salary <= 0 || workingDays <= 0 || days <= 0) return 0;
  return round2(Math.min(salary, (salary / workingDays) * days));
};

/** Net amount exactly like payroll.service.ts#generate: basic + allowances - deductions. */
export const netAmount = (basicSalary: number, allowances: number, deductions: number): number =>
  round2(basicSalary + allowances - deductions);

/** Sum of (checkOut - checkIn) minutes over rows having both, checkOut after checkIn. */
export const workedMinutes = (rows: Array<{ checkInAt: Date | null; checkOutAt: Date | null }>): number => {
  let ms = 0;
  for (const r of rows) {
    if (r.checkInAt && r.checkOutAt && r.checkOutAt > r.checkInAt) ms += r.checkOutAt.getTime() - r.checkInAt.getTime();
  }
  return Math.round(ms / 60_000);
};

export const minutesToHm = (minutes: number): string => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** Average local check-in time "HH:mm" (null when no check-ins). */
export const averageCheckIn = (checkIns: Array<Date | null>, timeZone: string): string | null => {
  const mins = checkIns.filter((d): d is Date => d instanceof Date).map((d) => localMinutesOfDay(d, timeZone));
  if (!mins.length) return null;
  return minutesToHm(mins.reduce((a, b) => a + b, 0) / mins.length);
};
