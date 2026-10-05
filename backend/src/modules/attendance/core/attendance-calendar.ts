import { env } from "../../../shared/config/env";
import { attendanceDeviceSettingsService } from "../../attendance-device/attendance-device-settings.service";
import { attendanceDeviceSettingsRepository } from "../../attendance-device/attendance-device-settings.repository";
import { isWeeklyOff } from "../../attendance-device/attendance-device-rules";
import { dateOnly, isValidDateString, localDateString } from "../../attendance-device/time.util";

/**
 * The madrasa's working-day calendar, shared by manual marking, reports,
 * leave, analytics and payroll. Off days = weekly off days
 * (AttendanceDeviceSettings.weeklyOffDays) + AttendanceHoliday rows - the
 * same source the device module uses, so every part of the system agrees on
 * which days count.
 *
 * Dates are "YYYY-MM-DD" local calendar dates (env ATTENDANCE_TIMEZONE);
 * DB DATE values are UTC midnight of that date (see time.util.ts#dateOnly).
 */

export { dateOnly, isValidDateString, localDateString };

export interface OffDay {
  date: string;
  reason: "holiday" | "weekly_off";
  title: string | null;
}

export interface CalendarRange {
  /** Every date in [from, to] that is not an off day, ascending. */
  workingDays: string[];
  /** Every off date in [from, to], ascending. */
  offDays: OffDay[];
}

/** Local "today" of the madrasa timezone. */
export const todayLocal = (now: Date = new Date()): string => localDateString(now, env.attendanceTimezone);

/** YYYY-MM-DD + n days (n may be negative). */
export const addDays = (dateStr: string, n: number): string => {
  const d = dateOnly(dateStr);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Inclusive list of YYYY-MM-DD dates from `from` to `to` (empty when from > to). */
export const eachDate = (from: string, to: string): string[] => {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
};

/** "YYYY-MM" -> first and last date of that month. */
export const monthBounds = (month: string): { from: string; to: string } | null => {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return { from: `${m[1]}-${m[2]}-01`, to: `${m[1]}-${m[2]}-${String(last).padStart(2, "0")}` };
};

export class AttendanceCalendar {
  /** Working and off days of [from, to] (inclusive) in one rules read + one holiday query. */
  async range(madrasaId: number, from: string, to: string): Promise<CalendarRange> {
    if (from > to) return { workingDays: [], offDays: [] };
    const [rules, holidays] = await Promise.all([
      attendanceDeviceSettingsService.getRules(madrasaId),
      attendanceDeviceSettingsRepository.listHolidays(madrasaId, dateOnly(from), dateOnly(addDays(to, 1))),
    ]);
    const holidayByDate = new Map(holidays.map((h) => [h.date.toISOString().slice(0, 10), h.title]));
    const workingDays: string[] = [];
    const offDays: OffDay[] = [];
    for (const date of eachDate(from, to)) {
      if (holidayByDate.has(date)) offDays.push({ date, reason: "holiday", title: holidayByDate.get(date) ?? null });
      else if (isWeeklyOff(rules, date)) offDays.push({ date, reason: "weekly_off", title: null });
      else workingDays.push(date);
    }
    return { workingDays, offDays };
  }

  /** Off-day info of a single date, or null when it is a working day. */
  async offDay(madrasaId: number, date: string): Promise<OffDay | null> {
    const info = await attendanceDeviceSettingsService.dayInfo(madrasaId, date);
    return info.off ? { date, reason: info.reason as OffDay["reason"], title: info.holidayTitle } : null;
  }
}

export const attendanceCalendar = new AttendanceCalendar();
