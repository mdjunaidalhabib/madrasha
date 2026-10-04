export const DEVICE_STATUSES = ["online", "offline", "unknown"] as const;
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

export const DEFAULT_DEVICE_PORT = 4370;
export const DEFAULT_POLL_INTERVAL_SEC = 30;
export const MIN_POLL_INTERVAL_SEC = 5;
export const MAX_POLL_INTERVAL_SEC = 3600;

/** A device is reported OFFLINE when its connector has been silent for more
 * than this many poll intervals (computed at read time, no cron needed). */
export const OFFLINE_AFTER_POLL_INTERVALS = 3;

export const MAX_INGEST_EVENTS = 500;

/** Punch timestamps further in the future than this are rejected (wrong K40 clock). */
export const MAX_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;
/** Punch timestamps older than this are rejected. */
export const MAX_PUNCH_AGE_MS = 400 * 24 * 60 * 60 * 1000;

/** Attendance.source written for device punches. */
export const DEVICE_ATTENDANCE_SOURCE = "k40";

/** SMS rule name used in the dedupe key: attn:{madrasaId}:{studentId}:{date}:{rule}. */
export const ATTENDANCE_SMS_RULE = "present";

export const ADMIN_PERMISSIONS = {
  manage: "attendance_device.manage",
  view: "attendance_device.view",
} as const;

export const MAX_REPROCESS_LOGS = 5000;
export const MAX_TODAY_LOGS = 20000;

/* ================= v2: people / cards / enrollment / rules ================= */

export const PERSON_TYPES = ["STUDENT", "TEACHER", "STAFF"] as const;
export type PersonType = (typeof PERSON_TYPES)[number];

/** Short ASCII prefix used for a K40 user name when the person has no usable English name. */
export const PERSON_NAME_PREFIX: Record<PersonType, string> = { STUDENT: "ST", TEACHER: "TR", STAFF: "SF" };
/** K40 user name field is 24 bytes. */
export const DEVICE_USER_NAME_MAX = 24;

/** Enrollment ("tap the card") session lifetime. */
export const ENROLLMENT_TTL_SEC = 120;
/** GET /connector/commands long-poll bounds. */
export const COMMANDS_DEFAULT_WAIT_SEC = 20;
export const COMMANDS_MAX_WAIT_SEC = 25;
export const COMMANDS_RECHECK_MS = 1000;

/** A punch is a check-out only if it is at least this long after the check-in. */
export const CHECKOUT_MIN_GAP_MS = 30 * 60 * 1000;

/** SMS rule names (dedupe key suffix). */
export const ATTENDANCE_SMS_RULES = { present: "present", checkout: "checkout", absent: "absent" } as const;

/** Attendance.source for rows created by the auto-absent job. */
export const AUTO_ABSENT_SOURCE = "auto";
/** SmsQueue.source for the device offline alert. */
export const DEVICE_ALERT_SMS_SOURCE = "device_alert";

/** Background job cadence. */
export const AUTO_ABSENT_INTERVAL_MS = 5 * 60 * 1000;
export const OFFLINE_ALERT_INTERVAL_MS = 2 * 60 * 1000;
export const JOBS_INITIAL_DELAY_MS = 45 * 1000;

export const MAX_PEOPLE_PAGE_LIMIT = 500;
