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
  PersonType,
} from "./attendance-device.constants";
import {
  CreateDeviceDto,
  ListMappingsQuery,
  SetMappingDto,
  UpdateDeviceDto,
} from "./attendance-device.dto";
import { attendanceDeviceRepository, AttendanceDeviceRepository } from "./attendance-device.repository";
import { attendanceDeviceIngestService, AttendanceDeviceIngestService } from "./attendance-device-ingest.service";
import { attendanceDevicePeopleService, AttendanceDevicePeopleService } from "./attendance-device-people.service";
import {
  attendanceDevicePeopleRepository,
  AttendanceDevicePeopleRepository,
} from "./attendance-device-people.repository";
import {
  attendanceDeviceSettingsService,
  AttendanceDeviceSettingsService,
} from "./attendance-device-settings.service";
import {
  DeviceSecretConfigError,
  encryptDeviceSecret,
  generateDeviceKey,
  hashDeviceKey,
  maskPhone,
} from "./device-secret.util";
import { dateOnly, isValidDateString, localDateString, localDayRangeUtc } from "./time.util";
import { tenantClassName } from "../../shared/utils/tenant-name.util";
import { t } from "../../shared/i18n";

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

/** Admin-facing device shape. NEVER includes api key (hash) or the comm password.
 * `usersVersion` = the madrasa's current desired K40 user-list version. */
export const toDeviceDto = (d: AttendanceDevice, now: Date, usersVersion: string | null = null) => {
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
    clock_drift_sec: d.clockDriftSec ?? null,
    users_synced_version: d.usersSyncedVersion ?? null,
    users_version: usersVersion,
    users_in_sync: usersVersion !== null && d.usersSyncedVersion === usersVersion,
    last_user_sync_at: iso(d.lastUserSyncAt),
    user_sync_error: d.userSyncError ?? null,
    device_user_count: d.deviceUserCount ?? null,
    queue_pending: d.queuePending ?? null,
    offline_alerted_at: iso(d.offlineAlertedAt),
    created_at: iso(d.createdAt),
    updated_at: iso(d.updatedAt),
  };
};

const classLabel = tenantClassName;

const encryptOrFail = (plain: string): string => {
  try {
    return encryptDeviceSecret(plain);
  } catch (err) {
    if (err instanceof DeviceSecretConfigError) {
      logger.error("DEVICE_SECRET_ENC_KEY is missing/invalid; cannot store device comm password");
      throw new ApiError(t({ bn: "সার্ভারে DEVICE_SECRET_ENC_KEY কনফিগার করা নেই, ডিভাইস পাসওয়ার্ড সংরক্ষণ করা যাচ্ছে না", en: "DEVICE_SECRET_ENC_KEY is not configured on the server, so the device password cannot be saved" }), 500);
    }
    throw err;
  }
};

export class AttendanceDeviceService {
  constructor(
    private readonly repository: AttendanceDeviceRepository = attendanceDeviceRepository,
    private readonly ingest: AttendanceDeviceIngestService = attendanceDeviceIngestService,
    private readonly now: () => Date = () => new Date(),
    private readonly people: AttendanceDevicePeopleService = attendanceDevicePeopleService,
    private readonly peopleRepository: AttendanceDevicePeopleRepository = attendanceDevicePeopleRepository,
    private readonly settings: AttendanceDeviceSettingsService = attendanceDeviceSettingsService,
  ) {}

  private get tz() {
    return env.attendanceTimezone;
  }

  /* ================= devices ================= */

  async listDevices(madrasaId: number) {
    const now = this.now();
    const [devices, usersVersion] = await Promise.all([
      this.repository.listDevices(madrasaId),
      this.people.usersVersion(madrasaId),
    ]);
    return devices.map((d) => toDeviceDto(d, now, usersVersion));
  }

  private async requireDevice(madrasaId: number, id: number) {
    const device = await this.repository.findDevice(madrasaId, id);
    if (!device) throw new NotFoundError(t({ bn: "ডিভাইস পাওয়া যায়নি", en: "Device not found" }));
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
        throw new ConflictError(t({ bn: "এই ডিভাইস আইডি ইতিমধ্যে ব্যবহৃত হয়েছে", en: "This device ID is already in use" }));
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
      if (res.count === 0) throw new NotFoundError(t({ bn: "ডিভাইস পাওয়া যায়নি", en: "Device not found" }));
    }
    logger.info("Attendance device updated", { madrasaId, deviceId: id, fields: Object.keys(data) });
    return toDeviceDto(await this.requireDevice(madrasaId, id), this.now());
  }

  async deleteDevice(madrasaId: number, id: number) {
    const res = await this.repository.deleteDevice(madrasaId, id);
    if (res.count === 0) throw new NotFoundError(t({ bn: "ডিভাইস পাওয়া যায়নি", en: "Device not found" }));
    logger.info("Attendance device deleted", { madrasaId, deviceId: id });
  }

  async rotateKey(madrasaId: number, id: number) {
    const device = await this.requireDevice(madrasaId, id);
    const rawKey = generateDeviceKey();
    const res = await this.repository.updateDevice(madrasaId, id, { apiKeyHash: hashDeviceKey(rawKey) });
    if (res.count === 0) throw new NotFoundError(t({ bn: "ডিভাইস পাওয়া যায়নি", en: "Device not found" }));
    logger.info("Attendance device key rotated", { madrasaId, deviceId: id });
    return { id: device.id, device_id: device.deviceCode, raw_key: rawKey };
  }

  async requestTest(madrasaId: number, id: number) {
    const at = this.now();
    const res = await this.repository.updateDevice(madrasaId, id, { testRequestedAt: at });
    if (res.count === 0) throw new NotFoundError(t({ bn: "ডিভাইস পাওয়া যায়নি", en: "Device not found" }));
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
        card_number: s.attendanceDeviceMaps[0]?.cardNumber ?? null,
      })),
      total,
      page: q.page,
      limit: q.limit,
      total_pages: Math.max(1, Math.ceil(total / q.limit)),
    };
  }

  async setMapping(madrasaId: number, dto: SetMappingDto) {
    const student = await this.repository.findStudentForMapping(madrasaId, dto.student_id);
    if (!student) throw new NotFoundError(t({ bn: "শিক্ষার্থী পাওয়া যায়নি", en: "Student not found" }));

    const conflict = await this.peopleRepository.findMapByDeviceUserId(madrasaId, dto.device_user_id);
    if (conflict && !(conflict.person?.type === "STUDENT" && conflict.person.id === dto.student_id)) {
      const other = conflict.person?.nameBn ?? "-";
      throw new ConflictError(t({ bn: `এই ডিভাইস ইউজার আইডি (${dto.device_user_id}) অন্য একজনের (${other}) সাথে যুক্ত আছে`, en: `This device user ID (${dto.device_user_id}) is linked to someone else (${other})` }));
    }

    try {
      await this.repository.replaceMap(madrasaId, dto.student_id, dto.device_user_id);
    } catch (err) {
      if ((err as { code?: string })?.code === "P2002") {
        throw new ConflictError(t({ bn: "এই ডিভাইস ইউজার আইডি অন্য শিক্ষার্থীর সাথে যুক্ত আছে", en: "This device user ID is linked to another student" }));
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
    if (!Number.isInteger(studentId) || studentId <= 0) throw new BadRequestError(t({ bn: "শিক্ষার্থীর id সঠিক নয়", en: "student id is invalid" }));
    const res = await this.repository.deleteMapByStudent(madrasaId, studentId);
    if (res.count === 0) throw new NotFoundError(t({ bn: "ম্যাপিং পাওয়া যায়নি", en: "Mapping not found" }));
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
    if (!isValidDateString(date)) throw new BadRequestError(t({ bn: "তারিখ অবশ্যই YYYY-MM-DD ফরম্যাটে হতে হবে", en: "date must be YYYY-MM-DD" }));
    return date;
  }

  /**
   * Device attendance of one local day for one person type (default STUDENT):
   * punches grouped per person (with the attendance row's status / check-in /
   * check-out), the mapped people who have not punched, and per-class totals.
   * summary.present counts PRESENT rows only; LATE people are only in summary.late.
   */
  async today(madrasaId: number, q: { date?: string; device_id?: number; attendee_type?: PersonType }) {
    const type: PersonType = q.attendee_type ?? "STUDENT";
    const date = this.resolveDate(q.date);
    const { start, end } = localDayRangeUtc(date, this.tz);

    let deviceFilter: number | undefined;
    if (q.device_id) {
      const device = await this.repository.findDevice(madrasaId, q.device_id);
      if (!device) throw new NotFoundError(t({ bn: "ডিভাইস পাওয়া যায়নি", en: "Device not found" }));
      deviceFilter = device.id;
    }

    const [logs, devices, day, attendanceRows, maps] = await Promise.all([
      this.repository.findLogsForRange(madrasaId, start, end, deviceFilter, type),
      this.repository.listDevices(madrasaId),
      this.settings.dayInfo(madrasaId, date),
      this.repository.findAttendanceForDate(madrasaId, dateOnly(date), type),
      this.peopleRepository.listAllMaps(madrasaId, type),
    ]);

    const accepted = logs.filter((l) => l.syncStatus !== "FAILED");
    const rejected = logs.length - accepted.length;
    const personIdOf = (l: (typeof logs)[number]): number | null =>
      type === "STUDENT" ? l.studentId : type === "TEACHER" ? l.teacherId : l.staffId;

    interface Row {
      person_id: number | null;
      device_user_id: string;
      first_punch_at: Date;
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
      const pid = personIdOf(l);
      const key = pid ? `p:${pid}` : `u:${l.deviceUserId}`;
      const g = groups.get(key);
      if (!g) {
        groups.set(key, {
          person_id: pid,
          device_user_id: l.deviceUserId,
          first_punch_at: l.punchedAt,
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

    // Person info: mapped people first, then whoever punched without a map row
    // (Student.fingerprintId fallback) or is no longer in the map list.
    interface Info {
      name: string | null;
      roll: number | null;
      class_id: number | null;
      class_name: string | null;
      registration_no: number | null;
    }
    const info = new Map<number, Info>();
    const mappedEligible = new Map<number, Info>();
    for (const m of maps) {
      if (!m.person) continue;
      const i: Info = {
        name: m.person.nameBn,
        roll: m.person.roll,
        class_id: m.person.classId,
        class_name: m.person.className,
        registration_no: m.person.registrationNo,
      };
      info.set(m.person.id, i);
      if (m.person.eligible) mappedEligible.set(m.person.id, i);
    }
    const unknownIds = [...groups.values()]
      .map((g) => g.person_id)
      .filter((v): v is number => v !== null && !info.has(v));
    if (unknownIds.length) {
      if (type === "STUDENT") {
        for (const s of await this.repository.findStudentsByIds(madrasaId, unknownIds)) {
          info.set(s.id, { name: s.nameBn, roll: s.roll, class_id: s.classId, class_name: classLabel(s.classRef), registration_no: null });
        }
      } else {
        for (const s of await this.repository.findStaffNamesByIds(madrasaId, type, unknownIds)) {
          info.set(s.id, { name: s.nameBn, roll: null, class_id: null, class_name: null, registration_no: null });
        }
      }
    }
    const attendanceById = new Map(attendanceRows.map((a) => [a.attendeeId, a]));

    const items = [...groups.values()]
      .map((g) => {
        const i = g.person_id ? info.get(g.person_id) : undefined;
        const att = g.person_id ? attendanceById.get(g.person_id) : undefined;
        const checkIn = att?.checkInAt ?? g.first_punch_at;
        return {
          attendee_type: g.person_id ? type : null,
          attendee_id: g.person_id,
          student_id: type === "STUDENT" ? g.person_id : null,
          student_name: i?.name ?? null,
          roll: i?.roll ?? null,
          class_id: i?.class_id ?? null,
          class_name: i?.class_name ?? null,
          device_user_id: g.device_user_id,
          mapped: g.person_id !== null,
          note: g.note,
          status: att?.status ?? null,
          check_in_at: checkIn.toISOString(),
          check_out_at: iso(att?.checkOutAt),
          last_punch_at: g.last_punch_at.toISOString(),
          punch_count: g.punch_count,
          device_id: g.device_id,
          device_name: g.device_name,
          sync_status: g.sync_status,
          received_at: g.received_at.toISOString(),
        };
      })
      .sort((a, b) => a.check_in_at.localeCompare(b.check_in_at));

    const punched = new Set(items.filter((i) => i.mapped).map((i) => i.attendee_id as number));
    const notArrived = [...mappedEligible.entries()]
      .filter(([id]) => {
        if (punched.has(id)) return false;
        const status = attendanceById.get(id)?.status;
        // marked present/late by hand (or on another device): not "not arrived"
        return status !== "PRESENT" && status !== "LATE";
      })
      .map(([id, i]) => {
        const status = attendanceById.get(id)?.status;
        return {
          attendee_id: id,
          name: i.name,
          roll: i.roll,
          class_id: i.class_id,
          class_name: i.class_name,
          status: status === "ABSENT" || status === "LEAVE" ? status : null,
          registration_no: i.registration_no,
        };
      })
      .sort((a, b) =>
        type === "STUDENT"
          ? (a.class_id ?? 0) - (b.class_id ?? 0) || (a.roll ?? 1e9) - (b.roll ?? 1e9) || a.attendee_id - b.attendee_id
          : (a.registration_no ?? 1e9) - (b.registration_no ?? 1e9) || a.attendee_id - b.attendee_id,
      )
      .map(({ registration_no: _r, ...rest }) => rest);

    const classes: { class_id: number | null; class_name: string | null; mapped_total: number; present: number; late: number; absent: number }[] = [];
    if (type === "STUDENT") {
      const byClass = new Map<string, (typeof classes)[number]>();
      const bucket = (classId: number | null, className: string | null) => {
        const key = String(classId);
        let c = byClass.get(key);
        if (!c) {
          c = { class_id: classId, class_name: className, mapped_total: 0, present: 0, late: 0, absent: 0 };
          byClass.set(key, c);
        }
        return c;
      };
      for (const i of mappedEligible.values()) bucket(i.class_id, i.class_name).mapped_total++;
      for (const it of items) {
        if (!it.mapped) continue;
        const c = bucket(it.class_id, it.class_name);
        if (it.status === "LATE") c.late++;
        else if (it.status === "PRESENT") c.present++;
      }
      for (const n of notArrived) if (n.status === "ABSENT") bucket(n.class_id, n.class_name).absent++;
      classes.push(...[...byClass.values()].sort((a, b) => (a.class_id ?? 0) - (b.class_id ?? 0)));
    }

    const scoped = deviceFilter ? devices.filter((d) => d.id === deviceFilter) : devices;
    const lastSync = scoped.reduce<Date | null>(
      (max, d) => (d.lastSyncAt && (!max || d.lastSyncAt > max) ? d.lastSyncAt : max),
      null,
    );

    return {
      date,
      attendee_type: type,
      is_holiday: day.off,
      holiday_title: day.holidayTitle ?? (day.reason === "weekly_off" ? "সাপ্তাহিক ছুটি" : null),
      summary: {
        present: items.filter((i) => i.mapped && i.status === "PRESENT").length,
        late: items.filter((i) => i.mapped && i.status === "LATE").length,
        absent: notArrived.filter((n) => n.status === "ABSENT").length,
        not_arrived: notArrived.length,
        checked_out: items.filter((i) => i.check_out_at !== null).length,
        unmapped: items.filter((i) => !i.mapped).length,
        total_punches: accepted.length,
        rejected_punches: rejected,
        last_sync_at: iso(lastSync),
        mapped_total: mappedEligible.size,
      },
      items,
      not_arrived: notArrived,
      classes,
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
