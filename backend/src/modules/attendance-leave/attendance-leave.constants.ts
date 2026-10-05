/** Leave workflow + consecutive-absence alerts (see attendance/ATTENDANCE_V3_API.md sections 2-3). */

export const LEAVE_TYPES = ["sick", "family", "travel", "other"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;

/** Attendance.source of rows written by an approved leave ("protected" source). */
export const LEAVE_ATTENDANCE_SOURCE = "leave";

/** LeaveRequest.requestedVia */
export const REQUESTED_VIA_ADMIN = "admin";
export const REQUESTED_VIA_GUARDIAN = "guardian";

/** Longest leave an admin can enter in one request (inclusive calendar days). */
export const MAX_ADMIN_LEAVE_DAYS = 366;
/** Guardian requests: at most this many calendar days ... */
export const MAX_GUARDIAN_LEAVE_DAYS = 30;
/** ... starting no earlier than today minus this many days. */
export const GUARDIAN_BACKDATE_DAYS = 3;

export const MAX_LEAVE_PAGE_LIMIT = 200;

/* ================= consecutive-absence alerts ================= */

/** SmsQueue.source of the consecutive-absence guardian SMS. */
export const CONSECUTIVE_SMS_SOURCE = "attendance_consecutive";
/** Job cadence (the job itself runs once per local day per madrasa). */
export const CONSECUTIVE_JOB_INTERVAL_MS = 10 * 60 * 1000;
export const CONSECUTIVE_JOB_INITIAL_DELAY_MS = 90 * 1000;
/** Run time when the device auto-absent job is off. */
export const CONSECUTIVE_DEFAULT_RUN_TIME = "12:00";
/** How far back a streak is followed (calendar days). */
export const STREAK_LOOKBACK_DAYS = 60;
/** Streak threshold of the alerts endpoint when the policy has the alert off. */
export const DEFAULT_STREAK_DAYS = 3;
