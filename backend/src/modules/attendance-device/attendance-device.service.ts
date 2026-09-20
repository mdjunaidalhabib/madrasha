import crypto from "crypto";
import type { AttendanceDevice } from "@prisma/client";
import { env } from "../../shared/config/env";
import { ApiError, BadRequestError, ConflictError, NotFoundError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import {
  DEFAULT_DEVICE_PORT,
  DEFAULT_POLL_INTERVAL_SEC,
  DeviceStatus,
  OFFLINE_AFTER_POLL_INTERVALS,
} from "./attendance-device.constants";
import {
  CreateDeviceDto,
  ListMappingsQuery,
  SetMappingDto,
  UpdateDeviceDto,
} from "./attendance-device.dto";
import { attendanceDeviceRepository, AttendanceDeviceRepository } from "./attendance-device.repository";
import { attendanceDeviceIngestService, AttendanceDeviceIngestService } from "./attendance-device-ingest.service";
import {
  DeviceSecretConfigError,
  encryptDeviceSecret,
  generateDeviceKey,
  hashDeviceKey,
  maskPhone,
} from "./device-secret.util";
import { dateOnly, isValidDateString, localDateString, localDayRangeUtc } from "./time.util";

/**
 * Effective status shown to admins, derived at read time: a connector that has
 * been silent for more than 3 poll intervals is OFFLINE regardless of what it
 * last reported; a never-seen device is UNKNOWN.
 */
export const computeDeviceStatus = (
  d: Pick<AttendanceDevice, "lastSeenAt" | "pollIntervalSec" | "status">,
  now: Date,
): DeviceStatus => {
  if (!d.lastSeenAt) return "unknown";
  const silentMs = now.getTime() - d.lastSeenAt.getTime();
  if (silentMs > OFFLINE_AFTER_POLL_INTERVALS * d.pollIntervalSec * 1000) return "offline";
  return d.status === "online" || d.status === "offline" ? d.status : "unknown";
};

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/** Admin-facing device shape. NEVER includes api key (hash) or the comm password. */
export const toDeviceDto = (d: AttendanceDevice, now: Date) => {
  const status = computeDeviceStatus(d, now);
  return {
    id: d.id,
    device_id: d.deviceCode,
    name: d.name,
    ip: d.ipAddress,
    port: d.port,
    has_comm_password: d.commPassword !== null,
    poll_interval_sec: d.pollIntervalSec,
    is_active: d.isActive,
    status,
    reported_status: d.status,
    connector_online: d.lastSeenAt
      ? now.getTime() - d.lastSeenAt.getTime() <= OFFLINE_AFTER_POLL_INTERVALS * d.pollIntervalSec * 1000
      : null,
    last_seen_at: iso(d.lastSeenAt),
    last_device_contact_at: iso(d.lastDeviceContactAt),
    last_sync_at: iso(d.lastSyncAt),
    last_error: d.lastError,
    connector_version: d.connectorVersion,
    test_requested_at: iso(d.testRequestedAt),
    last_test_at: iso(d.lastTestAt),
    last_test_ok: d.lastTestOk,
    last_test_message: d.lastTestMessage,
    created_at: iso(d.createdAt),
    updated_at: iso(d.updatedAt),
  };
};

const classLabel = (c: { nameBn: string | null; name: string | null } | null | undefined) =>
  c?.nameBn || c?.name || null;

const encryptOrFail = (plain: string): string => {
  try {
    return encryptDeviceSecret(plain);
  } catch (err) {
    if (err instanceof DeviceSecretConfigError) {
      logger.error("DEVICE_SECRET_ENC_KEY is missing/invalid; cannot store device comm password");
      throw new ApiError("সার্ভারে DEVICE_SECRET_ENC_KEY কনফিগার করা নেই, ডিভাইস পাসওয়ার্ড সংরক্ষণ করা যাচ্ছে না", 500);
    }
    throw err;
  }
};

export class AttendanceDeviceService {
  constructor(
    private readonly repository: AttendanceDeviceRepository = attendanceDeviceRepository,
    private readonly ingest: AttendanceDeviceIngestService = attendanceDeviceIngestService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private get tz() {
    return env.attendanceTimezone;
  }

  /* ================= devices ================= */

  async listDevices(madrasaId: number) {
    const now = this.now();
    const devices = await this.repository.listDevices(madrasaId);
    return devices.map((d) => toDeviceDto(d, now));
  }

  private async requireDevice(madrasaId: number, id: number) {
    const device = await this.repository.findDevice(madrasaId, id);
    if (!device) throw new NotFoundError("ডিভাইস পাওয়া যায়নি");
    return device;
  }

  async createDevice(madrasaId: number, dto: CreateDeviceDto) {
    const rawKey = generateDeviceKey();
    const deviceCode = dto.device_id || `k40-${crypto.randomBytes(3).toString("hex")}`;
    const commPassword = dto.comm_password ? encryptOrFail(dto.comm_password) : null;

    try {
      const device = await this.repository.createDevice({
        madrasaId,
        deviceCode,
        name: dto.name,
        ipAddress: dto.ip,
        port: dto.port ?? DEFAULT_DEVICE_PORT,
        commPassword,
        apiKeyHash: hashDeviceKey(rawKey),
        pollIntervalSec: dto.poll_interval_sec ?? DEFAULT_POLL_INTERVAL_SEC,
      });
      logger.info("Attendance device created", { madrasaId, deviceId: device.id });
      // raw_key is returned ONLY here and by rotate-key; only its hash is stored.
      return { ...toDeviceDto(device, this.now()), raw_key: rawKey };
    } catch (err) {
      if ((err as { code?: string })?.code === "P2002") {
        throw new ConflictError("এই ডিভাইস আইডি ইতিমধ্যে ব্যবহৃত হয়েছে");
      }
      throw err;
    }
  }

  async updateDevice(madrasaId: number, id: number, dto: UpdateDeviceDto) {
    await this.requireDevice(madrasaId, id);

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.ip !== undefined) data.ipAddress = dto.ip;
    if (dto.port !== undefined) data.port = dto.port;
    if (dto.poll_interval_sec !== undefined) data.pollIntervalSec = dto.poll_interval_sec;
    if (dto.is_active !== undefined) data.isActive = dto.is_active;
    // null clears the password, "" / omitted leaves it unchanged, a string replaces it.
    if (dto.comm_password === null) data.commPassword = null;
    else if (dto.comm_password) data.commPassword = encryptOrFail(dto.comm_password);

    if (Object.keys(data).length > 0) {
      const res = await this.repository.updateDevice(madrasaId, id, data);
      if (res.count === 0) throw new NotFoundError("ডিভাইস পাওয়া যায়নি");
    }
    logger.info("Attendance device updated", { madrasaId, deviceId: id, fields: Object.keys(data) });
    return toDeviceDto(await this.requireDevice(madrasaId, id), this.now());
  }

  async deleteDevice(madrasaId: number, id: number) {
    const res = await this.repository.deleteDevice(madrasaId, id);
    if (res.count === 0) throw new NotFoundError("ডিভাইস পাওয়া যায়নি");
    logger.info("Attendance device deleted", { madrasaId, deviceId: id });
  }

  async rotateKey(madrasaId: number, id: number) {
    const device = await this.requireDevice(madrasaId, id);
    const rawKey = generateDeviceKey();
    const res = await this.repository.updateDevice(madrasaId, id, { apiKeyHash: hashDeviceKey(rawKey) });
    if (res.count === 0) throw new NotFoundError("ডিভাইস পাওয়া যায়নি");
    logger.info("Attendance device key rotated", { madrasaId, deviceId: id });
    return { id: device.id, device_id: device.deviceCode, raw_key: rawKey };
  }

  async requestTest(madrasaId: number, id: number) {
    const at = this.now();
    const res = await this.repository.updateDevice(madrasaId, id, { testRequestedAt: at });
    if (res.count === 0) throw new NotFoundError("ডিভাইস পাওয়া যায়নি");
    return { test_requested_at: at.toISOString() };
  }

  /* ================= mappings ================= */

  async listMappings(madrasaId: number, q: ListMappingsQuery) {
    const { rows, total } = await this.repository.listStudentsWithMap(madrasaId, {
      search: q.search || undefined,
      classId: q.class_id,
      mapped: q.mapped === undefined ? undefined : q.mapped === "true",
      page: q.page,
      limit: q.limit,
    });
    return {
      items: rows.map((s) => ({
        student_id: s.id,
        name: s.nameBn,
        roll: s.roll,
        class_id: s.classId,
        class_name: classLabel(s.classRef),
        device_user_id: s.attendanceDeviceMaps[0]?.deviceUserId ?? null,
      })),
      total,
      page: q.page,
      limit: q.limit,
      total_pages: Math.max(1, Math.ceil(total / q.limit)),
    };
  }

  async setMapping(madrasaId: number, dto: SetMappingDto) {
    const student = await this.repository.findStudentForMapping(madrasaId, dto.student_id);
    if (!student) throw new NotFoundError("শিক্ষার্থী পাওয়া যায়নি");

    const conflict = await this.repository.findMapByDeviceUserId(madrasaId, dto.device_user_id);
    if (conflict && conflict.studentId !== dto.student_id) {
      throw new ConflictError(`এই ডিভাইস ইউজার আইডি (${dto.device_user_id}) অন্য শিক্ষার্থীর (${conflict.student.nameBn}) সাথে যুক্ত আছে`);
    }

    try {
      await this.repository.replaceMap(madrasaId, dto.student_id, dto.device_user_id);
    } catch (err) {
      if ((err as { code?: string })?.code === "P2002") {
        throw new ConflictError("এই ডিভাইস ইউজার আইডি অন্য শিক্ষার্থীর সাথে যুক্ত আছে");
      }
      throw err;
    }
    logger.info("Attendance device mapping set", { madrasaId, studentId: dto.student_id });

    // A failure while back-filling old punches must not undo/hide the mapping itself.
    let reprocessed = { logs: 0, attendance_marked: 0, sms_enqueued: 0 };
    try {
      reprocessed = await this.ingest.reprocessUnmapped(madrasaId, dto.device_user_id, dto.student_id);
    } catch (err) {
      logger.error("Attendance device reprocess after mapping failed", {
        madrasaId,
        studentId: dto.student_id,
        reason: (err as Error)?.message,
      });
    }
    return { student_id: dto.student_id, device_user_id: dto.device_user_id, reprocessed };
  }

  async deleteMapping(madrasaId: number, studentId: number) {
    if (!Number.isInteger(studentId) || studentId <= 0) throw new BadRequestError("student id is invalid");
    const res = await this.repository.deleteMapByStudent(madrasaId, studentId);
    if (res.count === 0) throw new NotFoundError("ম্যাপিং পাওয়া যায়নি");
  }

  async unmappedUsers(madrasaId: number) {
    const groups = await this.repository.groupUnmapped(madrasaId);
    const devices = await this.repository.findDevicesByIds(madrasaId, [...new Set(groups.map((g) => g.deviceId))]);
    const byId = new Map(devices.map((d) => [d.id, d]));
    return groups
      .map((g) => ({
        device_user_id: g.deviceUserId,
        device_id: byId.get(g.deviceId)?.deviceCode ?? null,
        device_name: byId.get(g.deviceId)?.name ?? null,
        punch_count: g._count._all,
        first_punch_at: iso(g._min.punchedAt),
        last_punch_at: iso(g._max.punchedAt),
      }))
      .sort((a, b) => String(b.last_punch_at).localeCompare(String(a.last_punch_at)));
  }

  /* ================= today ================= */

  private resolveDate(input?: string): string {
    const date = input || localDateString(this.now(), this.tz);
    if (!isValidDateString(date)) throw new BadRequestError("date must be YYYY-MM-DD");
    return date;
  }

  async today(madrasaId: number, q: { date?: string; device_id?: number }) {
    const date = this.resolveDate(q.date);
    const { start, end } = localDayRangeUtc(date, this.tz);

    let deviceFilter: number | undefined;
    if (q.device_id) {
      const device = await this.repository.findDevice(madrasaId, q.device_id);
      if (!device) throw new NotFoundError("ডিভাইস পাওয়া যায়নি");
      deviceFilter = device.id;
    }

    const [logs, devices] = await Promise.all([
      this.repository.findLogsForRange(madrasaId, start, end, deviceFilter),
      this.repository.listDevices(madrasaId),
    ]);

    const accepted = logs.filter((l) => l.syncStatus !== "FAILED");
    const rejected = logs.length - accepted.length;

    interface Row {
      student_id: number | null;
      device_user_id: string;
      check_in_at: Date;
      last_punch_at: Date;
      punch_count: number;
      device_id: string;
      device_name: string;
      sync_status: string;
      received_at: Date;
      note: string | null;
    }
    const groups = new Map<string, Row>();
    for (const l of accepted) {
      const key = l.studentId ? `s:${l.studentId}` : `u:${l.deviceUserId}`;
      const g = groups.get(key);
      if (!g) {
        groups.set(key, {
          student_id: l.studentId,
          device_user_id: l.deviceUserId,
          check_in_at: l.punchedAt,
          last_punch_at: l.punchedAt,
          punch_count: 1,
          device_id: l.device.deviceCode,
          device_name: l.device.name,
          sync_status: l.syncStatus,
          received_at: l.receivedAt,
          note: l.failReason,
        });
      } else {
        g.punch_count++;
        if (l.punchedAt > g.last_punch_at) g.last_punch_at = l.punchedAt;
        if (l.receivedAt > g.received_at) g.received_at = l.receivedAt;
      }
    }

    const studentIds = [...new Set([...groups.values()].map((g) => g.student_id).filter((v): v is number => v !== null))];
    const students = studentIds.length ? await this.repository.findStudentsByIds(madrasaId, studentIds) : [];
    const studentById = new Map(students.map((s) => [s.id, s]));

    const items = [...groups.values()]
      .map((g) => {
        const s = g.student_id ? studentById.get(g.student_id) : undefined;
        return {
          student_id: g.student_id,
          student_name: s?.nameBn ?? null,
          roll: s?.roll ?? null,
          class_id: s?.classId ?? null,
          class_name: classLabel(s?.classRef),
          device_user_id: g.device_user_id,
          mapped: g.student_id !== null,
          note: g.note,
          check_in_at: g.check_in_at.toISOString(),
          last_punch_at: g.last_punch_at.toISOString(),
          punch_count: g.punch_count,
          device_id: g.device_id,
          device_name: g.device_name,
          sync_status: g.sync_status,
          received_at: g.received_at.toISOString(),
        };
      })
      .sort((a, b) => a.check_in_at.localeCompare(b.check_in_at));

    const scoped = deviceFilter ? devices.filter((d) => d.id === deviceFilter) : devices;
    const lastSync = scoped.reduce<Date | null>(
      (max, d) => (d.lastSyncAt && (!max || d.lastSyncAt > max) ? d.lastSyncAt : max),
      null,
    );

    return {
      date,
      summary: {
        present: items.filter((i) => i.mapped).length,
        unmapped: items.filter((i) => !i.mapped).length,
        total_punches: accepted.length,
        rejected_punches: rejected,
        last_sync_at: iso(lastSync),
      },
      items,
    };
  }

  /* ================= sms status ================= */

  async smsStatus(madrasaId: number, q: { date?: string }) {
    const date = this.resolveDate(q.date);
    const rows = await this.repository.findSmsForDate(madrasaId, dateOnly(date));
    const studentIds = [...new Set(rows.map((r) => r.studentId).filter((v): v is number => v !== null))];
    const students = studentIds.length ? await this.repository.findStudentsByIds(madrasaId, studentIds) : [];
    const names = new Map(students.map((s) => [s.id, s.nameBn]));

    const summary = { pending: 0, processing: 0, sent: 0, failed: 0 };
    for (const r of rows) summary[r.status.toLowerCase() as keyof typeof summary]++;

    return {
      date,
      summary,
      items: rows.map((r) => ({
        id: r.id,
        student_id: r.studentId,
        student_name: r.studentId ? (names.get(r.studentId) ?? null) : null,
        attendance_id: r.attendanceId,
        status: r.status.toLowerCase(),
        attempts: r.attempts,
        max_attempts: r.maxAttempts,
        phone_masked: maskPhone(r.recipient),
        last_error: r.lastError,
        next_attempt_at: iso(r.nextAttemptAt),
        sent_at: iso(r.sentAt),
        queued_at: iso(r.createdAt),
      })),
    };
  }

}

export const attendanceDeviceService = new AttendanceDeviceService();
