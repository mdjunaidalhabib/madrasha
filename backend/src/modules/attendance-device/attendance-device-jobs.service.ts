import type { AttendanceDevice, AttendanceDeviceSettings } from "@prisma/client";
import { env } from "../../shared/config/env";
import { logger } from "../../shared/logger/logger";
import {
  AUTO_ABSENT_INTERVAL_MS,
  AUTO_ABSENT_SOURCE,
  DEVICE_ALERT_SMS_SOURCE,
  JOBS_INITIAL_DELAY_MS,
  OFFLINE_ALERT_INTERVAL_MS,
} from "./attendance-device.constants";
import { hmToMinutes, localMinutesOfDay, withDefaultRules } from "./attendance-device-rules";
import {
  attendanceDeviceJobsRepository,
  AttendanceDeviceJobsRepository,
} from "./attendance-device-jobs.repository";
import {
  attendanceDevicePeopleRepository,
  AttendanceDevicePeopleRepository,
  Person,
} from "./attendance-device-people.repository";
import {
  attendanceDeviceSettingsRepository,
  AttendanceDeviceSettingsRepository,
} from "./attendance-device-settings.repository";
import {
  attendanceDeviceSettingsService,
  AttendanceDeviceSettingsService,
} from "./attendance-device-settings.service";
import { attendanceDeviceIngestService, AttendanceDeviceIngestService } from "./attendance-device-ingest.service";
import { maskPhone } from "./device-secret.util";
import { dateOnly, localDateString } from "./time.util";

export interface AutoAbsentResult {
  madrasas: number;
  marked: number;
  sms_enqueued: number;
}

export interface OfflineAlertResult {
  alerted: number;
}

const OFFLINE_ALERT_TEMPLATE = "উপস্থিতি ডিভাইস '{name}' {minutes} মিনিট ধরে অফলাইন। কানেক্টর PC ও ইন্টারনেট পরীক্ষা করুন।";

/**
 * In-process schedulers (setInterval + unref, same pattern as core/bootstrap.ts):
 *  - auto absent: after absentCutoffTime every mapped, eligible person without
 *    an attendance row today gets ABSENT (+ guardian SMS for students);
 *  - offline alert: one SMS per outage when a device stays offline too long.
 * Both are idempotent, so several backend instances are safe.
 */
export class AttendanceDeviceJobsService {
  private absentRunning = false;
  private alertRunning = false;
  private timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly repository: AttendanceDeviceJobsRepository = attendanceDeviceJobsRepository,
    private readonly settingsRepository: AttendanceDeviceSettingsRepository = attendanceDeviceSettingsRepository,
    private readonly settings: AttendanceDeviceSettingsService = attendanceDeviceSettingsService,
    private readonly peopleRepository: AttendanceDevicePeopleRepository = attendanceDevicePeopleRepository,
    private readonly ingest: AttendanceDeviceIngestService = attendanceDeviceIngestService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private get tz() {
    return env.attendanceTimezone;
  }

  /* ================= auto absent ================= */

  /** One pass over every madrasa with auto-absent enabled. Single-flight per process. */
  async runAutoAbsent(): Promise<AutoAbsentResult | null> {
    if (this.absentRunning) return null;
    this.absentRunning = true;
    const total: AutoAbsentResult = { madrasas: 0, marked: 0, sms_enqueued: 0 };
    try {
      const rows = await this.settingsRepository.listSettingsWhere({ autoAbsentEnabled: true });
      for (const row of rows) {
        try {
          const r = await this.autoAbsentForMadrasa(row);
          if (r) {
            total.madrasas++;
            total.marked += r.marked;
            total.sms_enqueued += r.sms_enqueued;
          }
        } catch (err) {
          logger.error("Auto absent failed for madrasa", { madrasaId: row.madrasaId, reason: (err as Error)?.message });
        }
      }
      return total;
    } catch (err) {
      logger.error("Auto absent pass failed", { reason: (err as Error)?.message });
      return total;
    } finally {
      this.absentRunning = false;
    }
  }

  /** null = nothing to do for this madrasa right now (already done / before cutoff / day off). */
  async autoAbsentForMadrasa(row: AttendanceDeviceSettings): Promise<{ marked: number; sms_enqueued: number } | null> {
    const madrasaId = row.madrasaId;
    const rules = withDefaultRules(row);
    const now = this.now();
    const today = localDateString(now, this.tz);

    if (rules.lastAutoAbsentDate && rules.lastAutoAbsentDate.toISOString().slice(0, 10) === today) return null;
    const cutoff = hmToMinutes(rules.absentCutoffTime);
    if (cutoff === null || localMinutesOfDay(now, this.tz) < cutoff) return null;
    const day = await this.settings.dayInfo(madrasaId, today, rules);
    if (day.off) return null;

    const date = dateOnly(today);
    const [maps, existing] = await Promise.all([
      this.peopleRepository.listAllMaps(madrasaId),
      this.repository.findAttendanceKeysForDate(madrasaId, date),
    ]);
    const done = new Set(existing.map((a) => `${a.attendeeType}:${a.attendeeId}`));
    const missing: Person[] = [];
    const seen = new Set<string>();
    for (const m of maps) {
      const p = m.person;
      if (!p || !p.eligible) continue;
      const key = `${p.type}:${p.id}`;
      if (done.has(key) || seen.has(key)) continue;
      seen.add(key);
      missing.push(p);
    }

    let marked = 0;
    for (let i = 0; i < missing.length; i += 500) {
      const res = await this.repository.createAttendances(
        missing.slice(i, i + 500).map((p) => ({
          madrasaId,
          attendeeType: p.type,
          attendeeId: p.id,
          classId: p.type === "STUDENT" ? p.classId : null,
          date,
          status: "ABSENT" as const,
          remarks: null,
          markedById: null,
          source: AUTO_ABSENT_SOURCE,
        })),
      );
      marked += res.count;
    }

    // SMS for every student still auto-ABSENT today (covers a crash between
    // the insert and this step on an earlier run; the dedupe key keeps it single).
    let sms = 0;
    const absentStudents = await this.repository.findAutoAbsentStudents(madrasaId, date);
    if (absentStudents.length) {
      const byId = new Map(maps.filter((m) => m.person?.type === "STUDENT").map((m) => [m.person!.id, m.person!]));
      const getContext = this.ingest.smsContextLoader(madrasaId);
      for (const a of absentStudents) {
        const student = byId.get(a.attendeeId);
        if (!student || !student.eligible) continue;
        const r = await this.ingest.enqueueStudentSms(madrasaId, "absent", student, now, a.id, getContext);
        if (r === "enqueued") sms++;
        if (r === "disabled") break;
      }
    }

    await this.settingsRepository.setLastAutoAbsentDate(madrasaId, date);
    logger.info("Auto absent marked", { madrasaId, date: today, marked, smsEnqueued: sms });
    return { marked, sms_enqueued: sms };
  }

  /* ================= device offline alert ================= */

  /** Since when the device counts as offline, or null when it does not (yet). */
  private offlineSince(d: AttendanceDevice, now: Date, thresholdMs: number): Date | null {
    if (!d.lastSeenAt) return null;
    if (now.getTime() - d.lastSeenAt.getTime() > thresholdMs) return d.lastSeenAt;
    if (d.status === "offline" && d.lastDeviceContactAt && now.getTime() - d.lastDeviceContactAt.getTime() > thresholdMs) {
      return d.lastDeviceContactAt;
    }
    return null;
  }

  async runOfflineAlerts(): Promise<OfflineAlertResult | null> {
    if (this.alertRunning) return null;
    this.alertRunning = true;
    const result: OfflineAlertResult = { alerted: 0 };
    try {
      const rows = await this.settingsRepository.listSettingsWhere({ offlineAlertEnabled: true });
      for (const row of rows) {
        try {
          result.alerted += await this.offlineAlertsForMadrasa(row);
        } catch (err) {
          logger.error("Device offline alert failed for madrasa", { madrasaId: row.madrasaId, reason: (err as Error)?.message });
        }
      }
      return result;
    } catch (err) {
      logger.error("Device offline alert pass failed", { reason: (err as Error)?.message });
      return result;
    } finally {
      this.alertRunning = false;
    }
  }

  /**
   * Operational alert: NOT gated by the notification master switch, but it
   * still goes through the SMS queue worker (billing + provider + audit log).
   */
  async offlineAlertsForMadrasa(row: AttendanceDeviceSettings): Promise<number> {
    const madrasaId = row.madrasaId;
    const rules = withDefaultRules(row);
    const now = this.now();
    const thresholdMs = Math.max(1, rules.offlineAlertMinutes) * 60_000;
    const devices = await this.repository.findAlertCandidates(madrasaId);
    let alerted = 0;
    let recipient: string | null | undefined;

    for (const d of devices) {
      const since = this.offlineSince(d, now, thresholdMs);
      if (!since || !d.lastSeenAt) continue;
      if (recipient === undefined) {
        recipient = rules.alertPhone || (await this.repository.findMadrasaPhone(madrasaId))?.phone || null;
      }
      if (!recipient) {
        logger.warn("Device offline alert skipped: no alert phone", { madrasaId, deviceId: d.id });
        return alerted;
      }
      const minutes = Math.max(1, Math.floor((now.getTime() - since.getTime()) / 60_000));
      const message = OFFLINE_ALERT_TEMPLATE.replace("{name}", d.name).replace("{minutes}", String(minutes));
      await this.repository.enqueueSms({
        madrasaId,
        dedupeKey: `devoff:${d.id}:${d.lastSeenAt.getTime()}`,
        recipient,
        message,
        maxAttempts: env.smsMaxAttempts,
        source: DEVICE_ALERT_SMS_SOURCE,
        forDate: dateOnly(localDateString(now, this.tz)),
      });
      await this.repository.markOfflineAlerted(madrasaId, d.id, now);
      alerted++;
      logger.warn("Device offline alert queued", { madrasaId, deviceId: d.id, minutes, phone: maskPhone(recipient) });
    }
    return alerted;
  }

  /* ================= scheduling ================= */

  start(): void {
    if (this.timers.length) return;
    this.timers.push(
      setTimeout(() => void this.runAutoAbsent(), JOBS_INITIAL_DELAY_MS),
      setInterval(() => void this.runAutoAbsent(), AUTO_ABSENT_INTERVAL_MS),
      setTimeout(() => void this.runOfflineAlerts(), JOBS_INITIAL_DELAY_MS),
      setInterval(() => void this.runOfflineAlerts(), OFFLINE_ALERT_INTERVAL_MS),
    );
    this.timers.forEach((t) => t.unref());
    logger.info("Attendance device jobs started", {
      autoAbsentIntervalMs: AUTO_ABSENT_INTERVAL_MS,
      offlineAlertIntervalMs: OFFLINE_ALERT_INTERVAL_MS,
    });
  }

  stop(): void {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
  }
}

export const attendanceDeviceJobsService = new AttendanceDeviceJobsService();
