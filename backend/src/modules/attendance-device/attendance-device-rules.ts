import type { AttendanceDeviceSettings } from "@prisma/client";
import { DEVICE_USER_NAME_MAX, PERSON_NAME_PREFIX, PersonType } from "./attendance-device.constants";

/**
 * Pure attendance-rule helpers (no DB): settings defaults, late / check-out
 * windows in the madrasa's local time, ASCII K40 user names, card numbers.
 */

export type DeviceRules = Omit<AttendanceDeviceSettings, "id" | "madrasaId" | "createdAt" | "updatedAt">;

/** Defaults applied when a madrasa has no attendance_device_settings row (mirror the schema defaults). */
export const DEFAULT_DEVICE_RULES: DeviceRules = {
  lateEnabled: false,
  studentStartTime: "08:00",
  teacherStartTime: "08:00",
  lateGraceMinutes: 10,
  autoAbsentEnabled: false,
  absentCutoffTime: "10:30",
  lastAutoAbsentDate: null,
  checkoutEnabled: false,
  checkoutAfterTime: "12:00",
  // No settings row yet = no weekly off day, so existing madrasas keep getting
  // Friday attendance until an admin turns the day off in ডিভাইস সেটিংস.
  weeklyOffDays: [],
  offlineAlertEnabled: false,
  offlineAlertMinutes: 15,
  alertPhone: null,
  autoTimeSync: true,
  pinMode: "registration",
  pinStart: 10001,
};

export const PIN_MODES = ["registration", "auto"] as const;
export type PinMode = (typeof PIN_MODES)[number];

/** Registration-mode PIN offsets: student = reg no, teacher = 90000 + reg no, staff = 95000 + reg no. */
export const REGISTRATION_PIN_OFFSET: Record<PersonType, number> = { STUDENT: 0, TEACHER: 90000, STAFF: 95000 };

/** The registration-mode PIN of a person, or null when it has no (positive) registration number. */
export const registrationPin = (type: PersonType, registrationNo: number | null | undefined): string | null => {
  if (registrationNo === null || registrationNo === undefined || !Number.isInteger(registrationNo) || registrationNo <= 0) {
    return null;
  }
  return String(REGISTRATION_PIN_OFFSET[type] + registrationNo);
};

export const withDefaultRules = (row: Partial<DeviceRules> | null | undefined): DeviceRules => ({
  ...DEFAULT_DEVICE_RULES,
  ...(row ? Object.fromEntries(Object.entries(row).filter(([k, v]) => k in DEFAULT_DEVICE_RULES && v !== undefined)) : {}),
});

export const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "HH:mm" -> minutes after local midnight (invalid -> null). */
export const hmToMinutes = (value: string): number | null => {
  if (!HHMM_RE.test(value)) return null;
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
};

/** Minutes after local midnight of `at` in `timeZone` (seconds dropped). */
export const localMinutesOfDay = (at: Date, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
};

/** JS weekday (0 = Sunday ... 6 = Saturday) of a YYYY-MM-DD calendar date. */
export const weekdayOf = (dateStr: string): number => new Date(`${dateStr}T00:00:00.000Z`).getUTCDay();

export const isWeeklyOff = (rules: Pick<DeviceRules, "weeklyOffDays">, dateStr: string) =>
  (rules.weeklyOffDays ?? []).includes(weekdayOf(dateStr));

/**
 * PRESENT or LATE for a check-in at `at`: LATE when late detection is on and
 * the local time (minute precision) is after start + grace. Students use
 * studentStartTime, teachers/staff teacherStartTime.
 */
export const arrivalStatus = (
  rules: Pick<DeviceRules, "lateEnabled" | "studentStartTime" | "teacherStartTime" | "lateGraceMinutes">,
  type: PersonType,
  at: Date,
  timeZone: string,
): "PRESENT" | "LATE" => {
  if (!rules.lateEnabled) return "PRESENT";
  const start = hmToMinutes(type === "STUDENT" ? rules.studentStartTime : rules.teacherStartTime);
  if (start === null) return "PRESENT";
  return localMinutesOfDay(at, timeZone) > start + Math.max(0, rules.lateGraceMinutes) ? "LATE" : "PRESENT";
};

/** true when check-out tracking is on and `at` is at/after checkoutAfterTime (local). */
export const inCheckoutWindow = (
  rules: Pick<DeviceRules, "checkoutEnabled" | "checkoutAfterTime">,
  at: Date,
  timeZone: string,
): boolean => {
  if (!rules.checkoutEnabled) return false;
  const after = hmToMinutes(rules.checkoutAfterTime);
  return after !== null && localMinutesOfDay(at, timeZone) >= after;
};

/** Bangla word for the {status} SMS token. */
export const statusWord = (status: string): string => (status === "LATE" ? "দেরিতে উপস্থিত" : "উপস্থিত");

/**
 * ASCII-only K40 user name (max 24 bytes): the English name reduced to
 * [A-Za-z0-9 .-], else "ST-{pin}" / "TR-{pin}" / "SF-{pin}".
 */
export const deviceUserName = (type: PersonType, nameEn: string | null | undefined, pin: string): string => {
  const cleaned = String(nameEn ?? "")
    .replace(/[^A-Za-z0-9 .-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, DEVICE_USER_NAME_MAX)
    .trim();
  return cleaned || `${PERSON_NAME_PREFIX[type]}-${pin}`.slice(0, DEVICE_USER_NAME_MAX);
};

/** Bangla digits (০-৯) -> ASCII digits. */
export const toAsciiDigits = (value: string): string =>
  value.replace(/[০-৯]/g, (ch) => String(ch.charCodeAt(0) - 0x09e6));

/** Bangla digits converted, digits only (1..20), leading zeros stripped; "0"/invalid -> null. */
export const normalizeCardNumber = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const s = toAsciiDigits(String(value)).trim();
  if (!/^[0-9]{1,20}$/.test(s)) return null;
  const stripped = s.replace(/^0+/, "");
  return stripped ? stripped : null;
};

/** Stable PIN order: numeric PINs by value, then anything else by string. */
export const comparePins = (a: string, b: string): number => {
  const an = /^\d+$/.test(a);
  const bn = /^\d+$/.test(b);
  if (an && bn) {
    const stripA = a.replace(/^0+(?=\d)/, "");
    const stripB = b.replace(/^0+(?=\d)/, "");
    if (stripA.length !== stripB.length) return stripA.length - stripB.length;
    if (stripA !== stripB) return stripA < stripB ? -1 : 1;
    return a < b ? -1 : a > b ? 1 : 0;
  }
  if (an !== bn) return an ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
};
