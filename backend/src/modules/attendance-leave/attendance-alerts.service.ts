import type { AttendancePolicy, AttendanceStatus } from "@prisma/client";
import { env } from "../../shared/config/env";
import { logger } from "../../shared/logger/logger";
import { attendanceCalendar, AttendanceCalendar, addDays, dateOnly, todayLocal } from "../attendance/core/attendance-calendar";
import { attendancePolicyRepository, AttendancePolicyRepository, getPolicy, withDefaultPolicy } from "../attendance/core/attendance-policy";
import { takenDaysFor } from "../attendance/core/attendance-stats";
import { attendanceDeviceRepository, AttendanceDeviceRepository } from "../attendance-device/attendance-device.repository";
import {
  attendanceDeviceSettingsService,
  AttendanceDeviceSettingsService,
} from "../attendance-device/attendance-device-settings.service";
import type { Person } from "../attendance-device/attendance-device-people.repository";
import { hmToMinutes, localMinutesOfDay } from "../attendance-device/attendance-device-rules";
import { maskPhone } from "../attendance-device/device-secret.util";
import { displayDate } from "../attendance-device/time.util";
import { notificationRepository } from "../notifications/notification.repository";
import { EventConfigSource, renderTemplate, resolveEventConfig } from "../notifications/notification.utils";
import {
  CONSECUTIVE_DEFAULT_RUN_TIME,
  CONSECUTIVE_JOB_INITIAL_DELAY_MS,
  CONSECUTIVE_JOB_INTERVAL_MS,
  CONSECUTIVE_SMS_SOURCE,
  DEFAULT_STREAK_DAYS,
  STREAK_LOOKBACK_DAYS,
} from "./attendance-leave.constants";
import type { ConsecutiveQuery } from "./attendance-leave.dto";
import { attendanceLeaveRepository, AttendanceLeaveRepository } from "./attendance-leave.repository";
import { absenceStreak, shouldAlert, Streak } from "./attendance-leave.rules";

export interface ConsecutiveRow {
  student_id: number;
  name: string;
  class_name: string | null;
  roll: number | null;
  guardian_phone: string | null;
  streak: number;
  since: string;
}

interface StudentStreak extends Streak {
  person: Person;
  /** Newest ABSENT row of the streak (linked on the SMS row). */
  lastAttendanceId: number | null;
}

export interface ConsecutiveJobResult {
  madrasas: number;
  alerted: number;
}

/**
 * Consecutive-absence alerts (attendance/ATTENDANCE_V3_API.md section 3).
 * A streak = the newest N taken WORKING days of a student all carry an
 * ABSENT row. The daily job queues one guardian SMS per streak through the
 * shared SmsQueue (same queue/worker/billing as the device attendance SMS).
 */
export class AttendanceAlertsService {
  private running = false;
  private timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly repository: AttendanceLeaveRepository = attendanceLeaveRepository,
    private readonly policyRepository: AttendancePolicyRepository = attendancePolicyRepository,
    private readonly calendar: AttendanceCalendar = attendanceCalendar,
    private readonly deviceSettings: AttendanceDeviceSettingsService = attendanceDeviceSettingsService,
    private readonly smsRepository: Pick<AttendanceDeviceRepository, "enqueueSms"> = attendanceDeviceRepository,
    private readonly notifications: EventConfigSource = notificationRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly takenDays: typeof takenDaysFor = takenDaysFor,
  ) {}

  /* ================= streak detection ================= */

  /** Eligible students whose streak is >= minDays, longest first. */
  async findStreaks(madrasaId: number, minDays: number, classId?: number): Promise<StudentStreak[]> {
    const today = todayLocal(this.now());
    const from = addDays(today, -STREAK_LOOKBACK_DAYS);
    const [{ workingDays }, taken] = await Promise.all([
      this.calendar.range(madrasaId, from, today),
      this.takenDays(madrasaId, "STUDENT", from, today),
    ]);
    const takenDesc = workingDays.filter((d) => taken.has(d)).reverse();
    if (takenDesc.length < minDays) return [];

    const candidateIds = await this.repository.findStudentsAbsentOnAll(madrasaId, takenDesc.slice(0, minDays), classId);
    const people = await this.repository.findEligibleStudents(madrasaId, candidateIds, classId);
    if (!people.length) return [];

    const rows = await this.repository.findStudentRows(
      madrasaId,
      people.map((p) => p.id),
      takenDesc[takenDesc.length - 1],
      today,
    );
    const byStudent = new Map<number, Map<string, AttendanceStatus>>();
    const lastAbsentId = new Map<number, { date: string; id: number }>();
    for (const r of rows) {
      const date = r.date.toISOString().slice(0, 10);
      if (!byStudent.has(r.attendeeId)) byStudent.set(r.attendeeId, new Map());
      byStudent.get(r.attendeeId)!.set(date, r.status);
      if (r.status === "ABSENT") {
        const cur = lastAbsentId.get(r.attendeeId);
        if (!cur || date > cur.date) lastAbsentId.set(r.attendeeId, { date, id: r.id });
      }
    }

    const out: StudentStreak[] = [];
    for (const person of people) {
      const s = absenceStreak(takenDesc, byStudent.get(person.id) ?? new Map());
      if (s.streak >= minDays) out.push({ ...s, person, lastAttendanceId: lastAbsentId.get(person.id)?.id ?? null });
    }
    return out.sort(
      (a, b) =>
        b.streak - a.streak ||
        (a.person.className ?? "").localeCompare(b.person.className ?? "") ||
        (a.person.roll ?? 0) - (b.person.roll ?? 0),
    );
  }

  /** GET /attendance-leaves/alerts/consecutive */
  async consecutive(madrasaId: number, q: ConsecutiveQuery): Promise<ConsecutiveRow[]> {
    const policy = await getPolicy(madrasaId);
    const days = q.days ?? (policy.consecutiveAbsentDays >= 2 ? policy.consecutiveAbsentDays : DEFAULT_STREAK_DAYS);
    const streaks = await this.findStreaks(madrasaId, days, q.class_id);
    return streaks.map((s) => ({
      student_id: s.person.id,
      name: s.person.nameBn,
      class_name: s.person.className,
      roll: s.person.roll,
      guardian_phone: s.person.guardianPhone,
      streak: s.streak,
      since: s.since!,
    }));
  }

  /* ================= daily job ================= */

  /** One pass over every madrasa with the alert on. Single-flight per process. */
  async runOnce(): Promise<ConsecutiveJobResult | null> {
    if (this.running) return null;
    this.running = true;
    const total: ConsecutiveJobResult = { madrasas: 0, alerted: 0 };
    try {
      const rows = await this.policyRepository.listWhere({ consecutiveAbsentDays: { gte: 2 } });
      for (const row of rows) {
        try {
          const alerted = await this.alertsForMadrasa(row);
          if (alerted !== null) {
            total.madrasas++;
            total.alerted += alerted;
          }
        } catch (err) {
          logger.error("Consecutive absence alert failed for madrasa", { madrasaId: row.madrasaId, reason: (err as Error)?.message });
        }
      }
      return total;
    } catch (err) {
      logger.error("Consecutive absence alert pass failed", { reason: (err as Error)?.message });
      return total;
    } finally {
      this.running = false;
    }
  }

  /**
   * null = nothing to do right now (already done today / too early / waiting
   * for the auto-absent job). Otherwise the number of SMS queued; the day is
   * then marked done (policy.lastConsecutiveCheck) so it runs once per day.
   */
  async alertsForMadrasa(row: AttendancePolicy): Promise<number | null> {
    const madrasaId = row.madrasaId;
    const policy = withDefaultPolicy(row);
    const threshold = policy.consecutiveAbsentDays;
    if (threshold < 2) return null;
    const now = this.now();
    const today = todayLocal(now);
    if (policy.lastConsecutiveCheck && policy.lastConsecutiveCheck.toISOString().slice(0, 10) === today) return null;

    // After the device auto-absent cutoff (so today's ABSENT rows exist), else at noon.
    const rules = await this.deviceSettings.getRules(madrasaId);
    const runAt = hmToMinutes(rules.autoAbsentEnabled ? rules.absentCutoffTime : CONSECUTIVE_DEFAULT_RUN_TIME);
    if (runAt === null || localMinutesOfDay(now, env.attendanceTimezone) < runAt) return null;
    const off = await this.calendar.offDay(madrasaId, today);
    if (!off && rules.autoAbsentEnabled) {
      const autoDone = rules.lastAutoAbsentDate && rules.lastAutoAbsentDate.toISOString().slice(0, 10) === today;
      if (!autoDone) return null;
    }

    let alerted = 0;
    if (!off) {
      const config = await resolveEventConfig(this.notifications, madrasaId, "ATTENDANCE_CONSECUTIVE_ABSENT");
      if (config.enabled) alerted = await this.enqueueAlerts(madrasaId, threshold, today, config.template);
    }
    await this.policyRepository.setLastConsecutiveCheck(madrasaId, dateOnly(today));
    if (alerted) logger.info("Consecutive absence alerts queued", { madrasaId, date: today, alerted });
    return alerted;
  }

  private async enqueueAlerts(madrasaId: number, threshold: number, today: string, template: string): Promise<number> {
    const streaks = await this.findStreaks(madrasaId, threshold);
    if (!streaks.length) return 0;
    const oldestSince = streaks.reduce((m, s) => (s.since! < m ? s.since! : m), today);
    const lastAlerts = await this.repository.lastAlertDates(
      madrasaId,
      CONSECUTIVE_SMS_SOURCE,
      streaks.map((s) => s.person.id),
      oldestSince,
    );

    let queued = 0;
    for (const s of streaks) {
      if (!shouldAlert(s, threshold, lastAlerts.get(s.person.id) ?? null)) continue;
      const phone = s.person.guardianPhone;
      if (!phone) continue;
      try {
        const message = renderTemplate(template, {
          name: s.person.nameBn,
          class: s.person.className || "",
          roll: s.person.roll ?? "",
          days: s.streak,
          from: displayDate(s.since!),
          date: displayDate(today),
        });
        const res = await this.smsRepository.enqueueSms({
          madrasaId,
          dedupeKey: `consec:${madrasaId}:${s.person.id}:${today}`,
          recipient: phone,
          message,
          maxAttempts: env.smsMaxAttempts,
          source: CONSECUTIVE_SMS_SOURCE,
          studentId: s.person.id,
          attendanceId: s.lastAttendanceId,
          forDate: dateOnly(today),
        });
        if (res.count > 0) {
          queued++;
          logger.info("Consecutive absence SMS enqueued", {
            madrasaId,
            studentId: s.person.id,
            streak: s.streak,
            phone: maskPhone(phone),
          });
        }
      } catch (err) {
        logger.error("Consecutive absence SMS enqueue failed", { madrasaId, studentId: s.person.id, reason: (err as Error)?.message });
      }
    }
    return queued;
  }

  /* ================= scheduling ================= */

  start(): void {
    if (this.timers.length) return;
    this.timers.push(
      setTimeout(() => void this.runOnce(), CONSECUTIVE_JOB_INITIAL_DELAY_MS),
      setInterval(() => void this.runOnce(), CONSECUTIVE_JOB_INTERVAL_MS),
    );
    this.timers.forEach((t) => t.unref());
    logger.info("Attendance consecutive-absence job started", { intervalMs: CONSECUTIVE_JOB_INTERVAL_MS });
  }

  stop(): void {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
  }
}

export const attendanceAlertsService = new AttendanceAlertsService();
