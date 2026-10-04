import { z } from "zod";
import {
  COMMANDS_DEFAULT_WAIT_SEC,
  COMMANDS_MAX_WAIT_SEC,
  MAX_INGEST_EVENTS,
  MAX_PEOPLE_PAGE_LIMIT,
  MAX_POLL_INTERVAL_SEC,
  MIN_POLL_INTERVAL_SEC,
  PERSON_TYPES,
} from "./attendance-device.constants";
import { HHMM_RE, PIN_MODES, toAsciiDigits } from "./attendance-device-rules";
import { vmsg } from "../../shared/validators/messages";

/* ================= shared field schemas ================= */

const deviceCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/, vmsg({ bn: "device_id-এ অক্ষর, সংখ্যা, _ . - থাকতে পারে (সর্বোচ্চ ৬৪)", en: "device_id may contain letters, digits, _ . - (max 64)" }));

const hostOrIp = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9.:-]+$/, vmsg({ bn: "ip অবশ্যই একটি IPv4/IPv6 ঠিকানা বা হোস্টনেম হতে হবে", en: "ip must be an IPv4/IPv6 address or hostname" }));

const port = z.coerce.number().int().min(1).max(65535);
const pollInterval = z.coerce.number().int().min(MIN_POLL_INTERVAL_SEC).max(MAX_POLL_INTERVAL_SEC);
const scalarId = z.union([z.string(), z.number()]);

/* ================= admin ================= */

export const createDeviceSchema = z.object({
  device_id: deviceCode.optional(),
  name: z.string().trim().min(1).max(100),
  ip: hostOrIp,
  port: port.optional(),
  comm_password: z.string().max(64).nullable().optional(),
  poll_interval_sec: pollInterval.optional(),
});
export type CreateDeviceDto = z.infer<typeof createDeviceSchema>;

/** comm_password: omitted or "" = unchanged, null = clear, string = replace. */
export const updateDeviceSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  ip: hostOrIp.optional(),
  port: port.optional(),
  comm_password: z.string().max(64).nullable().optional(),
  poll_interval_sec: pollInterval.optional(),
  is_active: z.boolean().optional(),
});
export type UpdateDeviceDto = z.infer<typeof updateDeviceSchema>;

export const setMappingSchema = z.object({
  student_id: z.coerce.number().int().positive(),
  device_user_id: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .pipe(z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/, vmsg({ bn: "device_user_id-এ অক্ষর, সংখ্যা, _ - থাকতে পারে", en: "device_user_id may contain letters, digits, _ -" }))),
});
export type SetMappingDto = z.infer<typeof setMappingSchema>;

export const listMappingsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  class_id: z.coerce.number().int().positive().optional(),
  mapped: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListMappingsQuery = z.infer<typeof listMappingsQuerySchema>;

export const todayQuerySchema = z.object({
  date: z.string().trim().optional(),
  device_id: z.coerce.number().int().positive().optional(),
  attendee_type: z.enum(PERSON_TYPES).default("STUDENT"),
});
export type TodayQuery = z.infer<typeof todayQuerySchema>;

/* ================= admin: settings / holidays ================= */

const hhmm = z
  .string()
  .trim()
  .regex(HHMM_RE, vmsg({ bn: "সময় অবশ্যই HH:mm (২৪ ঘণ্টা) ফরম্যাটে হতে হবে", en: "time must be HH:mm (24h)" }));

export const updateSettingsSchema = z
  .object({
    late_enabled: z.boolean(),
    student_start_time: hhmm,
    teacher_start_time: hhmm,
    late_grace_minutes: z.coerce.number().int().min(0).max(180),
    auto_absent_enabled: z.boolean(),
    absent_cutoff_time: hhmm,
    checkout_enabled: z.boolean(),
    checkout_after_time: hhmm,
    weekly_off_days: z
      .array(z.coerce.number().int().min(0).max(6))
      .max(7)
      .refine((days) => new Set(days).size === days.length, vmsg({ bn: "সাপ্তাহিক ছুটির দিন একবারই দিন", en: "weekly_off_days must be unique" })),
    offline_alert_enabled: z.boolean(),
    offline_alert_minutes: z.coerce.number().int().min(5).max(1440),
    alert_phone: z
      .string()
      .trim()
      .max(20)
      .regex(/^\+?[0-9]{6,19}$|^$/, vmsg({ bn: "সতর্কতার ফোন নম্বর সঠিক নয়", en: "alert_phone is invalid" }))
      .nullable(),
    auto_time_sync: z.boolean(),
    pin_mode: z.enum(PIN_MODES),
    pin_start: z.coerce.number().int().min(1).max(99_999_999),
  })
  .partial();
export type UpdateSettingsDto = z.infer<typeof updateSettingsSchema>;

const dateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, vmsg({ bn: "তারিখ অবশ্যই YYYY-MM-DD ফরম্যাটে হতে হবে", en: "date must be YYYY-MM-DD" }));

export const holidaysQuerySchema = z.object({ year: z.coerce.number().int().min(2000).max(2100).optional() });
export const createHolidaySchema = z.object({ date: dateString, title: z.string().trim().min(1).max(150) });
export type CreateHolidayDto = z.infer<typeof createHolidaySchema>;

/* ================= admin: people / cards / enrollment ================= */

const personType = z.enum(PERSON_TYPES);
const cardNumberInput = z
  .union([z.string(), z.number()])
  // Bangla digits -> ASCII, same normalisation as the connector "captured" path.
  .transform((v) => toAsciiDigits(String(v)).trim())
  .pipe(
    z
      .string()
      .regex(/^[0-9]{1,20}$/, vmsg({ bn: "কার্ড নম্বরে শুধু ১-২০টি অঙ্ক থাকতে পারে", en: "card_number must be 1-20 digits" }))
      .refine((v) => /[1-9]/.test(v), vmsg({ bn: "কার্ড নম্বর ০ হতে পারে না", en: "card_number cannot be 0" })),
  );

export const peopleQuerySchema = z.object({
  attendee_type: personType.default("STUDENT"),
  class_id: z.coerce.number().int().positive().optional(),
  search: z.string().trim().max(100).optional(),
  has_card: z.enum(["true", "false"]).optional(),
  attendee_id: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PEOPLE_PAGE_LIMIT).default(50),
});
export type PeopleQuery = z.infer<typeof peopleQuerySchema>;

export const assignPinsSchema = z.object({
  attendee_type: personType,
  class_id: z.coerce.number().int().positive().optional().nullable(),
});
export type AssignPinsDto = z.infer<typeof assignPinsSchema>;

export const convertPinsSchema = z.object({ attendee_type: personType.optional().nullable() });
export type ConvertPinsDto = z.infer<typeof convertPinsSchema>;

export const setCardSchema = z.object({
  attendee_type: personType,
  attendee_id: z.coerce.number().int().positive(),
  card_number: cardNumberInput,
});
export type SetCardDto = z.infer<typeof setCardSchema>;

export const personParamsSchema = z.object({
  attendeeType: z.string().trim().toUpperCase().pipe(personType),
  attendeeId: z.coerce.number().int().positive(),
});

export const createEnrollmentSchema = z.object({
  attendee_type: personType,
  attendee_id: z.coerce.number().int().positive(),
  device_id: z.coerce.number().int().positive().optional().nullable(),
});
export type CreateEnrollmentDto = z.infer<typeof createEnrollmentSchema>;

export const smsStatusQuerySchema = z.object({ date: z.string().trim().optional() });

/* ================= connector ================= */

const institutionId = z.union([z.string(), z.number()]).optional().nullable();

export const connectorConfigQuerySchema = z.object({
  device_id: deviceCode.optional(),
  institution_id: institutionId,
});

export const heartbeatSchema = z.object({
  device_id: deviceCode,
  institution_id: institutionId,
  device_status: z.enum(["online", "offline"]),
  last_device_contact_at: z.string().max(40).nullable().optional(),
  error: z.string().max(2000).nullable().optional(),
  test_result: z.object({ ok: z.boolean(), message: z.string().max(2000).nullable().optional() }).optional(),
  connector_version: z.string().max(32).nullable().optional(),
  clock_drift_sec: z.coerce.number().int().min(-2_000_000_000).max(2_000_000_000).nullable().optional(),
  users_synced_version: z.string().max(64).nullable().optional(),
  user_sync_error: z.string().max(2000).nullable().optional(),
  device_user_count: z.coerce.number().int().min(0).max(10_000_000).nullable().optional(),
});
export type HeartbeatDto = z.infer<typeof heartbeatSchema>;

export const commandsQuerySchema = z.object({
  device_id: deviceCode.optional(),
  institution_id: institutionId,
  wait: z.coerce.number().int().min(0).max(COMMANDS_MAX_WAIT_SEC).default(COMMANDS_DEFAULT_WAIT_SEC),
});

export const enrollmentReportSchema = z.object({
  device_id: deviceCode.optional(),
  institution_id: institutionId,
  status: z.enum(["waiting", "captured", "failed", "expired"]),
  card_number: z.union([z.string().max(40), z.number()]).nullable().optional(),
  message: z.string().max(2000).nullable().optional(),
});
export type EnrollmentReportDto = z.infer<typeof enrollmentReportSchema>;

/** Envelope only - each event is validated individually so one bad event is
 * reported as 'rejected' instead of failing the whole batch. */
export const ingestSchema = z.object({
  device_id: deviceCode,
  institution_id: institutionId,
  events: z.array(z.unknown()).min(1).max(MAX_INGEST_EVENTS),
});
export type IngestDto = z.infer<typeof ingestSchema>;

export const ingestEventSchema = z.object({
  event_id: scalarId,
  device_user_id: scalarId,
  timestamp: z.string(),
  verify_type: scalarId.nullable().optional(),
  in_out_state: scalarId.nullable().optional(),
});

/* ================= responses ================= */

export type IngestEventStatus = "accepted" | "duplicate" | "rejected";
export interface IngestEventResult {
  event_id: string;
  status: IngestEventStatus;
  reason?: string;
}

export interface IngestSummary {
  accepted: number;
  duplicate: number;
  rejected: number;
  unmapped: number;
  attendance_marked: number;
  sms_enqueued: number;
}
