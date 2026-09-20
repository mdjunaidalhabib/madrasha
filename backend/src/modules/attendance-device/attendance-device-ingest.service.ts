import type { AttendanceDevice } from "@prisma/client";
import { env } from "../../shared/config/env";
import { logger } from "../../shared/logger/logger";
import {
  ATTENDANCE_SMS_RULE,
  DEVICE_ATTENDANCE_SOURCE,
  MAX_FUTURE_SKEW_MS,
  MAX_PUNCH_AGE_MS,
} from "./attendance-device.constants";
import {
  HeartbeatDto,
  IngestDto,
  IngestEventResult,
  IngestSummary,
  ingestEventSchema,
} from "./attendance-device.dto";
import {
  attendanceDeviceRepository,
  AttendanceDeviceRepository,
  Db,
  ResolvedStudentRow,
} from "./attendance-device.repository";
import { notificationRepository } from "../notifications/notification.repository";
import { EventConfigSource, renderTemplate, resolveEventConfig } from "../notifications/notification.utils";
import {
  decryptDeviceSecret,
  maskPhone,
  sanitizeShortText,
} from "./device-secret.util";
import {
  dateOnly,
  displayDate,
  localDateString,
  localTimeString,
  parseIsoWithOffset,
} from "./time.util";

export const isEligibleStudent = (s: Pick<ResolvedStudentRow, "isActive" | "deletedAt" | "admissionStatus">) =>
  s.isActive === 1 && s.deletedAt === null && s.admissionStatus === "APPROVED";

interface Resolution {
  student: ResolvedStudentRow | null;
  /** Why there is no student: 'unmapped' | 'student_inactive'. */
  reason: "unmapped" | "student_inactive" | null;
}

interface ParsedEvent {
  index: number;
  eventId: string;
  error?: string;
  deviceUserId: string;
  punchedAt: Date | null;
  verifyType: string | null;
  inOutState: string | null;
}

interface AttendanceOutcome {
  attendanceId: number;
  created: boolean;
  upgraded: boolean;
  smsEligible: boolean;
  checkInAt: Date;
  date: string;
}

type PersistOutcome =
  | { kind: "duplicate" }
  | { kind: "accepted"; reason?: string; attendance?: AttendanceOutcome };

type SmsContext = { template: string } | null;
export type SmsEnqueueResult = "enqueued" | "duplicate" | "disabled" | "not_today" | "no_phone";

const shortScalar = (v: unknown, max: number): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
};

export class AttendanceDeviceIngestService {
  constructor(
    private readonly repository: AttendanceDeviceRepository = attendanceDeviceRepository,
    private readonly now: () => Date = () => new Date(),
    /** The existing auto-notification config (master switch + NotificationSetting rows). */
    private readonly notifications: EventConfigSource = notificationRepository,
  ) {}

  private get tz() {
    return env.attendanceTimezone;
  }

  /* ================= connector: config ================= */

  getConnectorConfig(device: AttendanceDevice) {
    let commPassword: string | null = null;
    if (device.commPassword) {
      try {
        commPassword = decryptDeviceSecret(device.commPassword);
      } catch (err) {
        // Wrong/missing DEVICE_SECRET_ENC_KEY or corrupted value - never log the payload.
        logger.error("Attendance device comm password could not be decrypted", {
          madrasaId: device.madrasaId,
          deviceId: device.id,
          reason: (err as Error)?.message,
        });
      }
    }
    return {
      device_id: device.deviceCode,
      name: device.name,
      ip: device.ipAddress,
      port: device.port,
      comm_password: commPassword,
      poll_interval_sec: device.pollIntervalSec,
      test_requested: device.testRequestedAt !== null,
      server_time: this.now().toISOString(),
    };
  }

  /* ================= connector: heartbeat ================= */

  async heartbeat(device: AttendanceDevice, dto: HeartbeatDto) {
    const now = this.now();
    const data: Record<string, unknown> = {
      status: dto.device_status,
      lastSeenAt: now,
    };

    const reportedContact = dto.last_device_contact_at ? parseIsoWithOffset(dto.last_device_contact_at) : null;
    if (reportedContact) data.lastDeviceContactAt = reportedContact;
    else if (dto.device_status === "online") data.lastDeviceContactAt = now;

    const error = sanitizeShortText(dto.error, 200);
    if (error) data.lastError = error;
    else if (dto.device_status === "online") data.lastError = null;

    if (dto.connector_version) data.connectorVersion = sanitizeShortText(dto.connector_version, 32);

    if (dto.test_result) {
      data.testRequestedAt = null;
      data.lastTestAt = now;
      data.lastTestOk = dto.test_result.ok;
      data.lastTestMessage = sanitizeShortText(dto.test_result.message, 200);
    }

    await this.repository.updateDevice(device.madrasaId, device.id, data);

    if (device.status !== dto.device_status) {
      logger.info("Attendance device status changed", {
        madrasaId: device.madrasaId,
        deviceId: device.id,
        from: device.status,
        to: dto.device_status,
      });
    }
    if (dto.test_result) {
      logger.info("Attendance device connection test reported", {
        madrasaId: device.madrasaId,
        deviceId: device.id,
        ok: dto.test_result.ok,
      });
    }

    return {
      server_time: now.toISOString(),
      test_requested: device.testRequestedAt !== null && !dto.test_result,
      poll_interval_sec: device.pollIntervalSec,
    };
  }

  /* ================= connector: ingest ================= */

  private parseEvents(rawEvents: unknown[]): ParsedEvent[] {
    return rawEvents.map((raw, index) => {
      const fallbackId = `#${index}`;
      const parsed = ingestEventSchema.safeParse(raw);
      if (!parsed.success) {
        const rawId =
          raw && typeof raw === "object" ? shortScalar((raw as Record<string, unknown>).event_id, 100) : null;
        return {
          index,
          eventId: rawId || fallbackId,
          error: "invalid_event",
          deviceUserId: "",
          punchedAt: null,
          verifyType: null,
          inOutState: null,
        };
      }
      const e = parsed.data;
      const eventId = shortScalar(e.event_id, 101) ?? "";
      const deviceUserId = shortScalar(e.device_user_id, 65) ?? "";
      const base = {
        index,
        eventId: eventId || fallbackId,
        deviceUserId,
        verifyType: shortScalar(e.verify_type, 32),
        inOutState: shortScalar(e.in_out_state, 32),
      };
      if (!eventId || eventId.length > 100) return { ...base, error: "invalid_event_id", punchedAt: null };
      if (!deviceUserId || deviceUserId.length > 64) return { ...base, error: "invalid_device_user_id", punchedAt: null };
      const punchedAt = parseIsoWithOffset(e.timestamp);
      if (!punchedAt) return { ...base, error: "invalid_timestamp", punchedAt: null };
      return { ...base, punchedAt };
    });
  }

  private async resolveStudents(madrasaId: number, deviceUserIds: string[]): Promise<Map<string, Resolution>> {
    const result = new Map<string, Resolution>();
    if (!deviceUserIds.length) return result;

    const maps = await this.repository.findMapsByDeviceUserIds(madrasaId, deviceUserIds);
    for (const m of maps) {
      result.set(
        m.deviceUserId,
        isEligibleStudent(m.student)
          ? { student: m.student, reason: null }
          : { student: null, reason: "student_inactive" },
      );
    }

    // Fallback (only when no map row exists): Student.fingerprintId == deviceUserId.
    const remaining = deviceUserIds.filter((id) => !result.has(id));
    if (remaining.length) {
      const students = await this.repository.findStudentsByFingerprintIds(madrasaId, remaining);
      for (const s of students) {
        if (!s.fingerprintId) continue;
        result.set(
          s.fingerprintId,
          isEligibleStudent(s) ? { student: s, reason: null } : { student: null, reason: "student_inactive" },
        );
      }
    }
    for (const id of deviceUserIds) {
      if (!result.has(id)) result.set(id, { student: null, reason: "unmapped" });
    }
    return result;
  }

  async ingest(device: AttendanceDevice, dto: IngestDto): Promise<{ results: IngestEventResult[]; summary: IngestSummary }> {
    const madrasaId = device.madrasaId;
    const now = this.now();
    const events = this.parseEvents(dto.events);
    const summary: IngestSummary = {
      accepted: 0,
      duplicate: 0,
      rejected: 0,
      unmapped: 0,
      attendance_marked: 0,
      sms_enqueued: 0,
    };
    const results: IngestEventResult[] = [];

    const valid = events.filter((e) => !e.error);
    const resolutions = await this.resolveStudents(madrasaId, [...new Set(valid.map((e) => e.deviceUserId))]);
    const getSmsContext = this.smsContextLoader(madrasaId);

    try {
      for (const ev of events) {
        if (ev.error || !ev.punchedAt) {
          results.push({ event_id: ev.eventId, status: "rejected", reason: ev.error || "invalid_event" });
          summary.rejected++;
          continue;
        }

        let rejectReason: string | null = null;
        if (ev.punchedAt.getTime() > now.getTime() + MAX_FUTURE_SKEW_MS) rejectReason = "timestamp_in_future";
        else if (ev.punchedAt.getTime() < now.getTime() - MAX_PUNCH_AGE_MS) rejectReason = "timestamp_too_old";

        const resolution = rejectReason
          ? ({ student: null, reason: null } as Resolution)
          : resolutions.get(ev.deviceUserId) || { student: null, reason: "unmapped" as const };

        const outcome = await this.persistWithRetry(device, ev, resolution, rejectReason);

        if (outcome.kind === "duplicate") {
          results.push({ event_id: ev.eventId, status: "duplicate" });
          summary.duplicate++;
          continue;
        }
        if (rejectReason) {
          results.push({ event_id: ev.eventId, status: "rejected", reason: rejectReason });
          summary.rejected++;
          continue;
        }

        summary.accepted++;
        results.push({
          event_id: ev.eventId,
          status: "accepted",
          ...(outcome.reason ? { reason: outcome.reason } : {}),
        });
        if (!resolution.student) {
          if (resolution.reason === "unmapped") summary.unmapped++;
          continue;
        }

        const att = outcome.attendance;
        if (att) {
          if (att.created || att.upgraded) summary.attendance_marked++;
          // Only AFTER the attendance transaction committed (persistWithRetry resolved).
          if (att.smsEligible) {
            const smsResult = await this.enqueueAttendanceSms(
              madrasaId,
              resolution.student,
              att.checkInAt,
              att.attendanceId,
              getSmsContext,
            );
            if (smsResult === "enqueued") summary.sms_enqueued++;
          }
        }
      }
    } finally {
      if (summary.accepted > 0) {
        await this.repository
          .updateDevice(madrasaId, device.id, { lastSyncAt: now, lastSeenAt: now })
          .catch((err) =>
            logger.error("Attendance device lastSyncAt update failed", { deviceId: device.id, reason: (err as Error)?.message }),
          );
      }
      logger.info("Attendance device ingest", {
        madrasaId,
        deviceId: device.id,
        received: dto.events.length,
        accepted: summary.accepted,
        duplicate: summary.duplicate,
        rejected: summary.rejected,
        unmapped: summary.unmapped,
      });
    }

    return { results, summary };
  }

  /** A concurrent writer can still win the attendance unique key (P2002 aborts the tx); retry once. */
  private async persistWithRetry(
    device: AttendanceDevice,
    ev: ParsedEvent,
    resolution: Resolution,
    rejectReason: string | null,
  ): Promise<PersistOutcome> {
    try {
      return await this.persistEvent(device, ev, resolution, rejectReason);
    } catch (err) {
      if ((err as { code?: string })?.code === "P2002") {
        return this.persistEvent(device, ev, resolution, rejectReason);
      }
      throw err;
    }
  }

  /**
   * One event = one transaction: log row + attendance upsert commit together
   * or not at all. A duplicate (any unique key) inserts nothing and returns
   * 'duplicate' without touching attendance or SMS.
   */
  private persistEvent(
    device: AttendanceDevice,
    ev: ParsedEvent,
    resolution: Resolution,
    rejectReason: string | null,
  ): Promise<PersistOutcome> {
    const madrasaId = device.madrasaId;
    return this.repository.transaction(async (tx) => {
      const inserted = await this.repository.insertLog(tx, {
        madrasaId,
        deviceId: device.id,
        eventId: ev.eventId,
        deviceUserId: ev.deviceUserId,
        punchedAt: ev.punchedAt as Date,
        verifyType: ev.verifyType,
        inOutState: ev.inOutState,
        studentId: resolution.student?.id ?? null,
        syncStatus: rejectReason ? "FAILED" : "SYNCED",
        failReason: rejectReason ?? (resolution.reason === "student_inactive" ? "student_inactive" : null),
      });
      if (inserted.count === 0) return { kind: "duplicate" } as PersistOutcome;
      if (rejectReason) return { kind: "accepted" } as PersistOutcome;
      if (!resolution.student) {
        return { kind: "accepted", reason: resolution.reason ?? "unmapped" } as PersistOutcome;
      }

      const attendance = await this.applyPunch(tx, madrasaId, resolution.student, ev.punchedAt as Date);
      await this.repository.attachAttendanceToLog(tx, madrasaId, device.id, ev.eventId, attendance.attendanceId);
      return { kind: "accepted", attendance } as PersistOutcome;
    });
  }

  /**
   * Attendance decision for one punch of an eligible student (local day of the punch):
   *  - no row            -> create PRESENT (source k40, checkInAt = punch)
   *  - row ABSENT        -> upgrade to PRESENT (a physical punch contradicts absent)
   *  - row PRESENT/LATE/LEAVE -> status untouched (never downgrade LATE/LEAVE);
   *                         only checkInAt is filled/lowered to the earliest punch
   * Must run inside a transaction: the caller commits the log row together with it.
   */
  private async applyPunch(
    tx: Db,
    madrasaId: number,
    student: Pick<ResolvedStudentRow, "id" | "classId">,
    punchedAt: Date,
  ): Promise<AttendanceOutcome> {
    const date = localDateString(punchedAt, this.tz);
    const dateValue = dateOnly(date);
    const existing = await this.repository.findAttendance(tx, madrasaId, student.id, dateValue);

    if (!existing) {
      const created = await this.repository.createAttendance(tx, {
        madrasaId,
        attendeeType: "STUDENT",
        attendeeId: student.id,
        classId: student.classId,
        date: dateValue,
        status: "PRESENT",
        remarks: null,
        markedById: null,
        source: DEVICE_ATTENDANCE_SOURCE,
        checkInAt: punchedAt,
      });
      return { attendanceId: created.id, created: true, upgraded: false, smsEligible: true, checkInAt: punchedAt, date };
    }

    if (existing.status === "ABSENT") {
      const updated = await this.repository.updateAttendance(tx, existing.id, {
        status: "PRESENT",
        source: DEVICE_ATTENDANCE_SOURCE,
        checkInAt: punchedAt,
      });
      return { attendanceId: updated.id, created: false, upgraded: true, smsEligible: true, checkInAt: punchedAt, date };
    }

    let checkInAt = existing.checkInAt;
    if (!checkInAt || punchedAt.getTime() < checkInAt.getTime()) {
      checkInAt = punchedAt;
      await this.repository.updateAttendance(tx, existing.id, { checkInAt });
    }
    return {
      attendanceId: existing.id,
      created: false,
      upgraded: false,
      // Retry-safety: our own earlier PRESENT row may have lost its SMS enqueue; dedupeKey keeps it single.
      smsEligible: existing.status === "PRESENT" && existing.source === DEVICE_ATTENDANCE_SOURCE,
      checkInAt,
      date,
    };
  }

  /* ================= SMS enqueue ================= */

  private smsContextLoader(madrasaId: number): () => Promise<SmsContext> {
    let cached: Promise<SmsContext> | null = null;
    return () => {
      cached ??= (async () => {
        // The existing অটো নোটিফিকেশন config: master switch AND the
        // ATTENDANCE_PRESENT setting (opt-in, default OFF); template from it.
        const config = await resolveEventConfig(this.notifications, madrasaId, "ATTENDANCE_PRESENT");
        return config.enabled ? { template: config.template } : null;
      })();
      return cached;
    };
  }

  /**
   * Queues the "student arrived" SMS: one per student per local day per rule
   * (dedupeKey, enforced by the DB unique index). Never throws - the
   * attendance row is already committed and an SMS problem must not fail ingest.
   */
  async enqueueAttendanceSms(
    madrasaId: number,
    student: Pick<ResolvedStudentRow, "id" | "nameBn" | "roll" | "classRef" | "guardianPhone">,
    punchedAt: Date,
    attendanceId: number,
    getContext: () => Promise<SmsContext>,
  ): Promise<SmsEnqueueResult | "error"> {
    try {
      const ctx = await getContext();
      if (!ctx) return "disabled";

      const date = localDateString(punchedAt, this.tz);
      if (date !== localDateString(this.now(), this.tz)) return "not_today";

      // Same phone source as every other auto-SMS path: guardianPhone, passed as-is.
      const phone = student.guardianPhone;
      if (!phone) return "no_phone";

      const message = renderTemplate(ctx.template, {
        name: student.nameBn,
        class: student.classRef?.nameBn || student.classRef?.name || "",
        roll: student.roll ?? "",
        time: localTimeString(punchedAt, this.tz),
        date: displayDate(date),
      });
      const dedupeKey = `attn:${madrasaId}:${student.id}:${date}:${ATTENDANCE_SMS_RULE}`;
      const res = await this.repository.enqueueSms({
        madrasaId,
        dedupeKey,
        recipient: phone,
        message,
        maxAttempts: env.smsMaxAttempts,
        source: "attendance",
        studentId: student.id,
        attendanceId,
        forDate: dateOnly(date),
      });
      if (res.count === 0) return "duplicate";
      logger.info("Attendance SMS enqueued", { madrasaId, studentId: student.id, phone: maskPhone(phone), date });
      return "enqueued";
    } catch (err) {
      logger.error("Attendance SMS enqueue failed", {
        madrasaId,
        studentId: student.id,
        reason: (err as Error)?.message,
      });
      return "error";
    }
  }

  /* ================= reprocess after a new mapping ================= */

  /**
   * After an admin maps deviceUserId -> studentId, apply the still-unprocessed
   * punches of that device user (attendance for their own punch days; SMS only
   * for punches of today, so old days never trigger late SMS).
   */
  async reprocessUnmapped(madrasaId: number, deviceUserId: string, studentId: number) {
    const totals = { logs: 0, attendance_marked: 0, sms_enqueued: 0 };
    const student = await this.repository.findStudentForMapping(madrasaId, studentId);
    if (!student || !isEligibleStudent(student)) return totals;

    const logs = await this.repository.findUnprocessedLogs(madrasaId, deviceUserId);
    const getSmsContext = this.smsContextLoader(madrasaId);

    for (const log of logs) {
      const attendance = await this.repository.transaction(async (tx) => {
        const outcome = await this.applyPunch(tx, madrasaId, student, log.punchedAt);
        await this.repository.linkLogToStudent(tx, log.id, student.id, outcome.attendanceId);
        return outcome;
      });
      totals.logs++;
      if (attendance.created || attendance.upgraded) totals.attendance_marked++;
      if (attendance.smsEligible) {
        const r = await this.enqueueAttendanceSms(
          madrasaId,
          student,
          attendance.checkInAt,
          attendance.attendanceId,
          getSmsContext,
        );
        if (r === "enqueued") totals.sms_enqueued++;
      }
    }
    logger.info("Attendance device logs reprocessed", { madrasaId, studentId, ...totals });
    return totals;
  }
}

export const attendanceDeviceIngestService = new AttendanceDeviceIngestService();
