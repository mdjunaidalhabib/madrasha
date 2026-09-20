import { z } from "zod";
import { MAX_INGEST_EVENTS, MAX_POLL_INTERVAL_SEC, MIN_POLL_INTERVAL_SEC } from "./attendance-device.constants";

/* ================= shared field schemas ================= */

const deviceCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/, "device_id may contain letters, digits, _ . - (max 64)");

const hostOrIp = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9.:-]+$/, "ip must be an IPv4/IPv6 address or hostname");

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
    .pipe(z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/, "device_user_id may contain letters, digits, _ -")),
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
});

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
});
export type HeartbeatDto = z.infer<typeof heartbeatSchema>;

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
