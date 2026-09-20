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
