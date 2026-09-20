/**
 * Calendar-day helpers. A punch belongs to the madrasa's LOCAL day
 * (env ATTENDANCE_TIMEZONE, default Asia/Dhaka), independent of the server's
 * own timezone. Attendance.date is a DATE column stored as UTC midnight of
 * that local day (same convention attendance.service.ts#parseDateOnly uses).
 */

/** Offset of `timeZone` from UTC at instant `at`, in minutes (e.g. +360 for Asia/Dhaka). */
export const tzOffsetMinutes = (timeZone: string, at: Date): number => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" }).formatToParts(at);
  const name = parts.find((p) => p.type === "timeZoneName")?.value || "GMT";
  const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3] || 0));
};

/** YYYY-MM-DD of `at` in `timeZone`. */
export const localDateString = (at: Date, timeZone: string): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);

/** "hh:mm AM/PM" of `at` in `timeZone`. */
export const localTimeString = (at: Date, timeZone: string): string =>
  new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", minute: "2-digit", hour12: true }).format(at);

/** DD/MM/YYYY of a YYYY-MM-DD string. */
export const displayDate = (dateStr: string): string => {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
};

/** Attendance.date value (UTC midnight) for a YYYY-MM-DD local date. */
export const dateOnly = (dateStr: string): Date => new Date(`${dateStr}T00:00:00.000Z`);

export const isValidDateString = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
};

/** [start, end) UTC instants bounding the local calendar day `dateStr`. */
export const localDayRangeUtc = (dateStr: string, timeZone: string): { start: Date; end: Date } => {
  const utcMidnight = new Date(`${dateStr}T00:00:00.000Z`).getTime();
  // Two passes so the offset is evaluated at the actual local midnight (matters only around DST).
  let offset = tzOffsetMinutes(timeZone, new Date(utcMidnight));
  offset = tzOffsetMinutes(timeZone, new Date(utcMidnight - offset * 60_000));
  const start = new Date(utcMidnight - offset * 60_000);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
};

const ISO_WITH_OFFSET =
  /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?)(Z|[+-]\d{2}(?::?\d{2})?)$/i;

/**
 * Parses an ISO-8601 timestamp that MUST carry an explicit UTC offset
 * ("2026-09-20T08:15:00+06:00" / "...Z"). A naive timestamp is rejected
 * (returns null) instead of being guessed at.
 */
export const parseIsoWithOffset = (value: unknown): Date | null => {
  if (typeof value !== "string") return null;
  const match = ISO_WITH_OFFSET.exec(value.trim());
  if (!match) return null;
  let offset = match[3].toUpperCase();
  if (offset !== "Z") {
    const digits = offset.slice(1).replace(":", "");
    offset = `${offset[0]}${digits.slice(0, 2)}:${digits.slice(2, 4) || "00"}`;
  }
  const time = match[2].length === 5 ? `${match[2]}:00` : match[2];
  const date = new Date(`${match[1]}T${time}${offset}`);
  return Number.isNaN(date.getTime()) ? null : date;
};
