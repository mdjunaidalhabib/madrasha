import type { AttendeeType } from "@prisma/client";
import { prisma } from "../../../shared/database/prisma";
import { attendanceCalendar, dateOnly, todayLocal } from "./attendance-calendar";
import { getPolicy, Policy } from "./attendance-policy";

/**
 * Working-day based attendance statistics - the ONE place the attendance
 * percentage is computed (monthly summary, reports, exam eligibility,
 * analytics, payroll all call this).
 *
 * Denominator = working days in the range (weekly off + holidays removed,
 * future days removed) on which attendance was actually taken for that
 * attendee type in the madrasa (at least one row of anybody), starting at
 * the attendee's first ever record. A taken day with no row for this
 * person counts as `unmarked` = absent. LEAVE follows policy.leaveMode and
 * every policy.lateToAbsentCount LATE days add one absent-equivalent.
 */

export interface StatusCounts {
  PRESENT: number;
  LATE: number;
  ABSENT: number;
  LEAVE: number;
}

export interface AttendanceStats extends StatusCounts {
  /** Working days considered (denominator before the leave rule). */
  working_days: number;
  /** Taken working days on which this person had no row (counted absent). */
  unmarked: number;
  /** Absent-equivalents added by the late rule. */
  late_penalty: number;
  /** PRESENT + LATE (+ LEAVE when leaveMode = present) - late_penalty. */
  attended: number;
  /** Final denominator. */
  counted_days: number;
  /** 0..100, one decimal. */
  percentage: number;
}

/** Pure formula. `workingDays` = days counted for this person. */
export const computeStats = (
  counts: StatusCounts,
  workingDays: number,
  policy: Pick<Policy, "lateToAbsentCount" | "leaveMode">,
): AttendanceStats => {
  const recorded = counts.PRESENT + counts.LATE + counts.ABSENT + counts.LEAVE;
  const unmarked = Math.max(0, workingDays - recorded);
  const latePenalty = policy.lateToAbsentCount > 0 ? Math.floor(counts.LATE / policy.lateToAbsentCount) : 0;
  let attended = counts.PRESENT + counts.LATE - latePenalty;
  let counted = Math.max(workingDays, recorded);
  if (policy.leaveMode === "present") attended += counts.LEAVE;
  else if (policy.leaveMode === "excluded") counted -= counts.LEAVE;
  attended = Math.max(0, attended);
  const percentage = counted > 0 ? Math.round((attended / counted) * 1000) / 10 : 0;
  return {
    ...counts,
    working_days: workingDays,
    unmarked,
    late_penalty: latePenalty,
    attended,
    counted_days: Math.max(0, counted),
    percentage: Math.min(100, percentage),
  };
};

const emptyCounts = (): StatusCounts => ({ PRESENT: 0, LATE: 0, ABSENT: 0, LEAVE: 0 });

export interface StatsOptions {
  /** Pre-loaded policy (saves a query when called in a loop). */
  policy?: Policy;
  /** Pre-loaded working days of the range. */
  workingDays?: string[];
  /** Pre-loaded set of dates on which attendance was taken for the type. */
  takenDays?: Set<string>;
}

/** Dates in [from, to] with at least one attendance row of `attendeeType` in the madrasa. */
export const takenDaysFor = async (
  madrasaId: number,
  attendeeType: AttendeeType,
  from: string,
  to: string,
): Promise<Set<string>> => {
  const rows = await prisma.attendance.groupBy({
    by: ["date"],
    where: { madrasaId, attendeeType, date: { gte: dateOnly(from), lte: dateOnly(to) } },
  });
  return new Set(rows.map((r) => r.date.toISOString().slice(0, 10)));
};

/**
 * Stats for MANY attendees of one type over [from, to] (future clipped to
 * today) with a fixed number of queries. Returns a map attendeeId -> stats.
 */
export const statsForAttendees = async (
  madrasaId: number,
  attendeeType: AttendeeType,
  attendeeIds: number[],
  from: string,
  to: string,
  opts: StatsOptions = {},
): Promise<Map<number, AttendanceStats>> => {
  const out = new Map<number, AttendanceStats>();
  if (!attendeeIds.length) return out;
  const today = todayLocal();
  const end = to > today ? today : to;
  const policy = opts.policy ?? (await getPolicy(madrasaId));
  if (from > end) {
    for (const id of attendeeIds) out.set(id, computeStats(emptyCounts(), 0, policy));
    return out;
  }

  const [workingDays, taken, rows, firsts] = await Promise.all([
    opts.workingDays ? Promise.resolve(opts.workingDays) : attendanceCalendar.range(madrasaId, from, end).then((r) => r.workingDays),
    opts.takenDays ? Promise.resolve(opts.takenDays) : takenDaysFor(madrasaId, attendeeType, from, end),
    prisma.attendance.groupBy({
      by: ["attendeeId", "status"],
      where: {
        madrasaId,
        attendeeType,
        attendeeId: { in: attendeeIds },
        date: { gte: dateOnly(from), lte: dateOnly(end) },
      },
      _count: { _all: true },
    }),
    prisma.attendance.groupBy({
      by: ["attendeeId"],
      where: { madrasaId, attendeeType, attendeeId: { in: attendeeIds } },
      _min: { date: true },
    }),
  ]);

  const takenWorking = workingDays.filter((d) => taken.has(d));
  const firstById = new Map(firsts.map((f) => [f.attendeeId, f._min.date?.toISOString().slice(0, 10) ?? null]));
  const countsById = new Map<number, StatusCounts>();
  for (const r of rows) {
    const c = countsById.get(r.attendeeId) ?? emptyCounts();
    c[r.status as keyof StatusCounts] = r._count._all;
    countsById.set(r.attendeeId, c);
  }

  for (const id of attendeeIds) {
    const first = firstById.get(id);
    const days = first ? takenWorking.filter((d) => d >= first).length : 0;
    out.set(id, computeStats(countsById.get(id) ?? emptyCounts(), days, policy));
  }
  return out;
};

/** Stats for one attendee. */
export const statsForAttendee = async (
  madrasaId: number,
  attendeeType: AttendeeType,
  attendeeId: number,
  from: string,
  to: string,
  opts: StatsOptions = {},
): Promise<AttendanceStats> =>
  (await statsForAttendees(madrasaId, attendeeType, [attendeeId], from, to, opts)).get(attendeeId)!;
