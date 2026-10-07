import type { AttendanceDevice, AttendanceStatus } from "@prisma/client";
import { env } from "../../shared/config/env";
import { logger } from "../../shared/logger/logger";
import {
  ATTENDANCE_SMS_RULES,
  CHECKOUT_MIN_GAP_MS,
  DEVICE_ATTENDANCE_SOURCE,
  MANUAL_ATTENDANCE_SOURCE,
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
import { attendanceDeviceRepository, AttendanceDeviceRepository, Db } from "./attendance-device.repository";
import {
  attendanceDevicePeopleRepository,
  AttendanceDevicePeopleRepository,
  Person,
  PersonRef,
  personIdColumns,
  studentToPerson,
} from "./attendance-device-people.repository";
import { attendanceDevicePeopleService, AttendanceDevicePeopleService } from "./attendance-device-people.service";
import {
  attendanceDeviceSettingsService,
  AttendanceDeviceSettingsService,
  DayInfo,
  RulesLoader,
} from "./attendance-device-settings.service";
import { arrivalStatus, DeviceRules, inCheckoutWindow, statusWord } from "./attendance-device-rules";
import { notificationRepository } from "../notifications/notification.repository";
import { NotificationEventKey } from "../notifications/notification.constants";
import { EventConfigSource, renderTemplate, resolveEventConfig } from "../notifications/notification.utils";
import { decryptDeviceSecret, maskPhone, sanitizeShortText } from "./device-secret.util";
import { dateOnly, displayDate, localDateString, localTimeString, parseIsoWithOffset } from "./time.util";

/** Kept for backward compatibility (students only). */
export const isEligibleStudent = (s: { isActive: number; deletedAt: Date | null; admissionStatus: string }) =>
  s.isActive === 1 && s.deletedAt === null && s.admissionStatus === "APPROVED";

type ResolutionReason = "unmapped" | "student_inactive" | "inactive";

interface Resolution {
  person: Person | null;
  /** Why there is no (usable) person. */
  reason: ResolutionReason | null;
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

export interface AttendanceOutcome {
  attendanceId: number;
  created: boolean;
  upgraded: boolean;
  status: AttendanceStatus;
  /** "arrived" SMS may be queued (dedupe keeps it single per day). */
  presentSms: boolean;
  /** This punch set the check-out for the first time. */
  checkoutSms: boolean;
  checkInAt: Date;
  checkOutAt: Date | null;
  date: string;
}

type PersistOutcome =
  | { kind: "duplicate" }
  | { kind: "accepted"; reason?: string; attendance?: AttendanceOutcome };

export type SmsKind = keyof typeof ATTENDANCE_SMS_RULES;
const SMS_EVENT: Record<SmsKind, NotificationEventKey> = {
  present: "ATTENDANCE_PRESENT",
  checkout: "ATTENDANCE_CHECKOUT",
  absent: "ATTENDANCE_ABSENT",
};

type SmsContext = { template: string } | null;
export type SmsContextLoader = (kind: SmsKind) => Promise<SmsContext>;
export type SmsEnqueueResult = "enqueued" | "duplicate" | "disabled" | "not_today" | "no_phone" | "not_student";

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
    private readonly settings: AttendanceDeviceSettingsService = attendanceDeviceSettingsService,
    private readonly people: AttendanceDevicePeopleService = attendanceDevicePeopleService,
    private readonly peopleRepository: AttendanceDevicePeopleRepository = attendanceDevicePeopleRepository,
  ) {}

  private get tz() {
    return env.attendanceTimezone;
  }

  /* ================= connector: config ================= */

  async getConnectorConfig(device: AttendanceDevice) {
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
    const [usersVersion, rules] = await Promise.all([
      this.people.usersVersion(device.madrasaId),
      this.settings.getRules(device.madrasaId),
    ]);
    return {
      device_id: device.deviceCode,
      name: device.name,
      ip: device.ipAddress,
      port: device.port,
      comm_password: commPassword,
      poll_interval_sec: device.pollIntervalSec,
      test_requested: device.testRequestedAt !== null,
      server_time: this.now().toISOString(),
      users_version: usersVersion,
      auto_time_sync: rules.autoTimeSync,
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

    // v2 telemetry (all optional; an omitted field leaves the column unchanged).
    if (dto.clock_drift_sec !== undefined && dto.clock_drift_sec !== null) data.clockDriftSec = dto.clock_drift_sec;
    if (dto.users_synced_version) {
      data.usersSyncedVersion = sanitizeShortText(dto.users_synced_version, 64);
      data.lastUserSyncAt = now;
    }
    if (dto.user_sync_error !== undefined) data.userSyncError = sanitizeShortText(dto.user_sync_error, 200) || null;
    if (dto.device_user_count !== undefined && dto.device_user_count !== null) data.deviceUserCount = dto.device_user_count;
    if (dto.queue_pending !== undefined && dto.queue_pending !== null) data.queuePending = dto.queue_pending;
    // One offline alert per outage: re-armed as soon as the device is reachable again.
    if (dto.device_status === "online") data.offlineAlertedAt = null;

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
      users_version: await this.people.usersVersion(device.madrasaId),
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

  private toResolution(person: Person): Resolution {
    if (person.eligible) return { person, reason: null };
    return { person: null, reason: person.type === "STUDENT" ? "student_inactive" : "inactive" };
  }

  /** deviceUserId -> map row (student/teacher/staff) -> else Student.fingerprintId. Nothing else is guessed. */
  private async resolvePeople(madrasaId: number, deviceUserIds: string[]): Promise<Map<string, Resolution>> {
    const result = new Map<string, Resolution>();
    if (!deviceUserIds.length) return result;

    // Current PIN first, then a PIN the person had before a convert-pins run.
    const maps = await this.peopleRepository.findMapsByDeviceUserIds(madrasaId, deviceUserIds);
    const wanted = new Set(deviceUserIds);
    const resolve = (m: (typeof maps)[number]): Resolution =>
      m.person ? this.toResolution(m.person) : { person: null, reason: "unmapped" };
    for (const m of maps) {
      if (wanted.has(m.deviceUserId)) result.set(m.deviceUserId, resolve(m));
    }
    for (const m of maps) {
      const prev = m.previousDeviceUserId;
      if (prev && wanted.has(prev) && !result.has(prev)) result.set(prev, resolve(m));
    }

    // Fallback (only when no map row exists): Student.fingerprintId == deviceUserId.
    const remaining = deviceUserIds.filter((id) => !result.has(id));
    if (remaining.length) {
      const students = await this.repository.findStudentsByFingerprintIds(madrasaId, remaining);
      for (const s of students) {
        if (!s.fingerprintId) continue;
        result.set(s.fingerprintId, this.toResolution(studentToPerson(s)));
      }
    }
    for (const id of deviceUserIds) {
      if (!result.has(id)) result.set(id, { person: null, reason: "unmapped" });
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
    const resolutions = await this.resolvePeople(madrasaId, [...new Set(valid.map((e) => e.deviceUserId))]);
    const getSmsContext = this.smsContextLoader(madrasaId);
    const rules = this.settings.rulesLoader(madrasaId);

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
          ? ({ person: null, reason: null } as Resolution)
          : resolutions.get(ev.deviceUserId) || { person: null, reason: "unmapped" as const };

        const day = resolution.person ? await rules.day(localDateString(ev.punchedAt, this.tz)) : null;
        const outcome = await this.persistWithRetry(device, ev, resolution, rejectReason, day, rules);

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
        if (!resolution.person) {
          if (resolution.reason === "unmapped") summary.unmapped++;
          continue;
        }

        const att = outcome.attendance;
        if (att) {
          if (att.created || att.upgraded) summary.attendance_marked++;
          // Only AFTER the attendance transaction committed (persistWithRetry resolved).
          summary.sms_enqueued += await this.enqueueOutcomeSms(madrasaId, resolution.person, att, getSmsContext);
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

  /** Student-only SMS after a committed attendance change. Returns how many were queued. */
  private async enqueueOutcomeSms(
    madrasaId: number,
    person: Person,
    att: AttendanceOutcome,
    getSmsContext: SmsContextLoader,
  ): Promise<number> {
    if (person.type !== "STUDENT") return 0;
    let queued = 0;
    if (att.presentSms) {
      const r = await this.enqueueStudentSms(madrasaId, "present", person, att.checkInAt, att.attendanceId, getSmsContext, {
        status: statusWord(att.status),
      });
      if (r === "enqueued") queued++;
    }
    if (att.checkoutSms && att.checkOutAt) {
      const r = await this.enqueueStudentSms(madrasaId, "checkout", person, att.checkOutAt, att.attendanceId, getSmsContext);
      if (r === "enqueued") queued++;
    }
    return queued;
  }

  /** A concurrent writer can still win the attendance unique key (P2002 aborts the tx); retry once. */
  private async persistWithRetry(
    device: AttendanceDevice,
    ev: ParsedEvent,
    resolution: Resolution,
    rejectReason: string | null,
    day: DayInfo | null,
    rules: RulesLoader,
  ): Promise<PersistOutcome> {
    try {
      return await this.persistEvent(device, ev, resolution, rejectReason, day, rules);
    } catch (err) {
      if ((err as { code?: string })?.code === "P2002") {
        return this.persistEvent(device, ev, resolution, rejectReason, day, rules);
      }
      throw err;
    }
  }

  /**
   * One event = one transaction: log row + attendance upsert commit together
   * or not at all. A duplicate (any unique key) inserts nothing and returns
   * 'duplicate' without touching attendance or SMS.
   */
  private async persistEvent(
    device: AttendanceDevice,
    ev: ParsedEvent,
    resolution: Resolution,
    rejectReason: string | null,
    day: DayInfo | null,
    rules: RulesLoader,
  ): Promise<PersistOutcome> {
    const madrasaId = device.madrasaId;
    const person = resolution.person;
    const offDay = !!(person && day?.off);
    const deviceRules = person && !offDay ? await rules.rules() : null;

    return this.repository.transaction(async (tx) => {
      const inserted = await this.repository.insertLog(tx, {
        madrasaId,
        deviceId: device.id,
        eventId: ev.eventId,
        deviceUserId: ev.deviceUserId,
        punchedAt: ev.punchedAt as Date,
        verifyType: ev.verifyType,
        inOutState: ev.inOutState,
        ...(person ? personIdColumns(person) : { studentId: null, teacherId: null, staffId: null }),
        syncStatus: rejectReason ? "FAILED" : "SYNCED",
        failReason:
          rejectReason ??
          (resolution.reason === "student_inactive" || resolution.reason === "inactive" ? resolution.reason : null) ??
          (offDay ? "holiday" : null),
      });
      if (inserted.count === 0) return { kind: "duplicate" } as PersistOutcome;
      if (rejectReason) return { kind: "accepted" } as PersistOutcome;
      if (!person) {
        return { kind: "accepted", reason: resolution.reason ?? "unmapped" } as PersistOutcome;
      }
      // Holiday / weekly off: the punch is kept, but no attendance and no SMS.
      if (offDay || !deviceRules) return { kind: "accepted", reason: "holiday" } as PersistOutcome;

      const attendance = await this.applyPunch(tx, madrasaId, person, ev.punchedAt as Date, deviceRules);
      await this.repository.attachAttendanceToLog(tx, madrasaId, device.id, ev.eventId, attendance.attendanceId);
      return { kind: "accepted", attendance } as PersistOutcome;
    });
  }

  /**
   * Attendance decision for one punch of an eligible person (local day of the punch):
   *  - no row            -> create PRESENT, or LATE when late detection is on and
   *                         the punch is after start + grace (checkInAt = punch)
   *  - row ABSENT        -> upgrade to PRESENT/LATE the same way (a physical punch
   *                         contradicts absent), checkInAt = punch
   *  - row PRESENT/LATE/LEAVE:
   *       check-out tracking on, punch >= checkoutAfterTime and >= checkInAt + 30 min
   *                       -> checkOutAt = max(checkOutAt, punch) (first one -> checkout SMS)
   *       otherwise       -> checkInAt lowered to the earliest punch; status is never
   *                         downgraded (only a k40 PRESENT/LATE is re-derived from the
   *                         new earliest check-in)
   * Must run inside a transaction: the caller commits the log row together with it.
   */
  private async applyPunch(
    tx: Db,
    madrasaId: number,
    person: Pick<Person, "type" | "id" | "classId">,
    punchedAt: Date,
    rules: DeviceRules,
  ): Promise<AttendanceOutcome> {
    const date = localDateString(punchedAt, this.tz);
    const dateValue = dateOnly(date);
    const existing = await this.repository.findAttendance(tx, madrasaId, person.type, person.id, dateValue);
    const arrival = arrivalStatus(rules, person.type, punchedAt, this.tz);

    if (!existing) {
      const created = await this.repository.createAttendance(tx, {
        madrasaId,
        attendeeType: person.type,
        attendeeId: person.id,
        classId: person.type === "STUDENT" ? person.classId : null,
        date: dateValue,
        status: arrival,
        remarks: null,
        markedById: null,
        source: DEVICE_ATTENDANCE_SOURCE,
        checkInAt: punchedAt,
      });
      return {
        attendanceId: created.id,
        created: true,
        upgraded: false,
        status: arrival,
        presentSms: true,
        checkoutSms: false,
        checkInAt: punchedAt,
        checkOutAt: null,
        date,
      };
    }

    // A person marked ABSENT by hand AFTER this punch happened: the punch only
    // reached the cloud late (offline queue). The later human decision wins
    // (e.g. punched in and left) - the row stays ABSENT, no SMS.
    if (
      existing.status === "ABSENT" &&
      existing.source === MANUAL_ATTENDANCE_SOURCE &&
      !!existing.updatedAt &&
      existing.updatedAt.getTime() > punchedAt.getTime()
    ) {
      return {
        attendanceId: existing.id,
        created: false,
        upgraded: false,
        status: existing.status,
        presentSms: false,
        checkoutSms: false,
        checkInAt: punchedAt,
        checkOutAt: existing.checkOutAt ?? null,
        date,
      };
    }

    if (existing.status === "ABSENT") {
      const updated = await this.repository.updateAttendance(tx, existing.id, {
        status: arrival,
        source: DEVICE_ATTENDANCE_SOURCE,
        checkInAt: punchedAt,
      });
      return {
        attendanceId: updated.id,
        created: false,
        upgraded: true,
        status: arrival,
        presentSms: true,
        checkoutSms: false,
        checkInAt: punchedAt,
        checkOutAt: existing.checkOutAt ?? null,
        date,
      };
    }

    const checkInAt = existing.checkInAt;
    if (
      checkInAt &&
      inCheckoutWindow(rules, punchedAt, this.tz) &&
      punchedAt.getTime() >= checkInAt.getTime() + CHECKOUT_MIN_GAP_MS
    ) {
      const previous = existing.checkOutAt ?? null;
      let checkOutAt = previous;
      if (!previous || punchedAt.getTime() > previous.getTime()) {
        checkOutAt = punchedAt;
        await this.repository.updateAttendance(tx, existing.id, { checkOutAt });
      }
      return {
        attendanceId: existing.id,
        created: false,
        upgraded: false,
        status: existing.status,
        presentSms: false,
        checkoutSms: previous === null,
        checkInAt,
        checkOutAt,
        date,
      };
    }

    let status = existing.status;
    let newCheckIn = checkInAt;
    if (!newCheckIn || punchedAt.getTime() < newCheckIn.getTime()) {
      newCheckIn = punchedAt;
      const data: { checkInAt: Date; status?: AttendanceStatus } = { checkInAt: newCheckIn };
      if (existing.source === DEVICE_ATTENDANCE_SOURCE && (status === "PRESENT" || status === "LATE")) {
        status = arrivalStatus(rules, person.type, newCheckIn, this.tz);
        data.status = status;
      }
      await this.repository.updateAttendance(tx, existing.id, data);
    }
    return {
      attendanceId: existing.id,
      created: false,
      upgraded: false,
      status,
      // Retry-safety: our own earlier row may have lost its SMS enqueue; dedupeKey keeps it single.
      presentSms: (status === "PRESENT" || status === "LATE") && existing.source === DEVICE_ATTENDANCE_SOURCE,
      checkoutSms: false,
      checkInAt: newCheckIn,
      checkOutAt: existing.checkOutAt ?? null,
      date,
    };
  }

  /* ================= SMS enqueue ================= */

  /** Per-request cache of the auto-notification config of each attendance SMS event. */
  smsContextLoader(madrasaId: number): SmsContextLoader {
    const cache = new Map<SmsKind, Promise<SmsContext>>();
    return (kind: SmsKind) => {
      let p = cache.get(kind);
      if (!p) {
        p = (async () => {
          // The existing অটো নোটিফিকেশন config: master switch AND the event's
          // setting (opt-in, default OFF); template from it.
          const config = await resolveEventConfig(this.notifications, madrasaId, SMS_EVENT[kind]);
          return config.enabled ? { template: config.template } : null;
        })();
        cache.set(kind, p);
      }
      return p;
    };
  }

  /**
   * Queues a guardian SMS (arrived / checked out / absent): one per student
   * per local day per rule (dedupeKey, enforced by the DB unique index). Never
   * throws - the attendance row is already committed and an SMS problem must
   * not fail ingest. Only for events of the local today.
   */
  async enqueueStudentSms(
    madrasaId: number,
    kind: SmsKind,
    student: Pick<Person, "type" | "id" | "nameBn" | "roll" | "classRef" | "className" | "guardianPhone">,
    at: Date,
    attendanceId: number,
    getContext: SmsContextLoader,
    extraVars: Record<string, string> = {},
  ): Promise<SmsEnqueueResult | "error"> {
    try {
      if (student.type !== "STUDENT") return "not_student";
      const ctx = await getContext(kind);
      if (!ctx) return "disabled";

      const date = localDateString(at, this.tz);
      if (date !== localDateString(this.now(), this.tz)) return "not_today";

      // Same phone source as every other auto-SMS path: guardianPhone, passed as-is.
      const phone = student.guardianPhone;
      if (!phone) return "no_phone";

      const message = renderTemplate(ctx.template, {
        name: student.nameBn,
        class: student.className || "",
        roll: student.roll ?? "",
        time: localTimeString(at, this.tz),
        date: displayDate(date),
        status: statusWord("PRESENT"),
        ...extraVars,
      });
      const rule = ATTENDANCE_SMS_RULES[kind];
      const dedupeKey = `attn:${madrasaId}:${student.id}:${date}:${rule}`;
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
      logger.info("Attendance SMS enqueued", { madrasaId, studentId: student.id, rule, phone: maskPhone(phone), date });
      return "enqueued";
    } catch (err) {
      logger.error("Attendance SMS enqueue failed", {
        madrasaId,
        studentId: student.id,
        kind,
        reason: (err as Error)?.message,
      });
      return "error";
    }
  }

  /* ================= reprocess after a new mapping ================= */

  /**
   * After an admin maps deviceUserId -> person, apply the still-unprocessed
   * punches of that device user (attendance for their own punch days; SMS only
   * for punches of today, so old days never trigger late SMS; holidays and
   * weekly off days are linked to the person without attendance).
   */
  async reprocessUnmapped(madrasaId: number, deviceUserId: string, target: number | PersonRef) {
    const ref: PersonRef = typeof target === "number" ? { type: "STUDENT", id: target } : target;
    const totals = { logs: 0, attendance_marked: 0, sms_enqueued: 0 };
    const person = await this.peopleRepository.findPerson(madrasaId, ref);
    if (!person || !person.eligible) return totals;

    const logs = await this.repository.findUnprocessedLogs(madrasaId, deviceUserId);
    const getSmsContext = this.smsContextLoader(madrasaId);
    const rules = this.settings.rulesLoader(madrasaId);
    const deviceRules = await rules.rules();

    for (const log of logs) {
      const day = await rules.day(localDateString(log.punchedAt, this.tz));
      const attendance = await this.repository.transaction(async (tx) => {
        if (day.off) {
          await this.repository.linkLogToPerson(tx, log.id, ref, null, "holiday");
          return null;
        }
        const outcome = await this.applyPunch(tx, madrasaId, person, log.punchedAt, deviceRules);
        await this.repository.linkLogToPerson(tx, log.id, ref, outcome.attendanceId, null);
        return outcome;
      });
      totals.logs++;
      if (!attendance) continue;
      if (attendance.created || attendance.upgraded) totals.attendance_marked++;
      totals.sms_enqueued += await this.enqueueOutcomeSms(madrasaId, person, attendance, getSmsContext);
    }
    logger.info("Attendance device logs reprocessed", { madrasaId, type: ref.type, personId: ref.id, ...totals });
    return totals;
  }
}

export const attendanceDeviceIngestService = new AttendanceDeviceIngestService();
