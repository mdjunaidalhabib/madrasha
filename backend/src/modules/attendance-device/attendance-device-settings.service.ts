import { env } from "../../shared/config/env";
import { BadRequestError, ConflictError, NotFoundError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import { t } from "../../shared/i18n";
import { CreateHolidayDto, UpdateSettingsDto } from "./attendance-device.dto";
import { DeviceRules, isWeeklyOff, withDefaultRules } from "./attendance-device-rules";
import {
  attendanceDeviceSettingsRepository,
  AttendanceDeviceSettingsRepository,
} from "./attendance-device-settings.repository";
import { dateOnly, isValidDateString, localDateString } from "./time.util";

export interface DayInfo {
  /** true = holiday or weekly off day: no device attendance, no SMS, no auto-absent. */
  off: boolean;
  reason: "holiday" | "weekly_off" | null;
  holidayTitle: string | null;
}

/** Admin-facing settings shape (snake_case, defaults filled in). */
export const toSettingsDto = (r: DeviceRules) => ({
  late_enabled: r.lateEnabled,
  student_start_time: r.studentStartTime,
  teacher_start_time: r.teacherStartTime,
  late_grace_minutes: r.lateGraceMinutes,
  auto_absent_enabled: r.autoAbsentEnabled,
  absent_cutoff_time: r.absentCutoffTime,
  checkout_enabled: r.checkoutEnabled,
  checkout_after_time: r.checkoutAfterTime,
  weekly_off_days: [...(r.weeklyOffDays ?? [])].sort((a, b) => a - b),
  offline_alert_enabled: r.offlineAlertEnabled,
  offline_alert_minutes: r.offlineAlertMinutes,
  alert_phone: r.alertPhone,
  auto_time_sync: r.autoTimeSync,
  pin_mode: r.pinMode === "auto" ? "auto" : "registration",
  pin_start: r.pinStart,
});

const toHolidayDto = (h: { id: number; date: Date; title: string }) => ({
  id: h.id,
  date: h.date.toISOString().slice(0, 10),
  title: h.title,
});

export class AttendanceDeviceSettingsService {
  constructor(
    private readonly repository: AttendanceDeviceSettingsRepository = attendanceDeviceSettingsRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Effective rules of a madrasa (schema defaults when it has no row). */
  async getRules(madrasaId: number): Promise<DeviceRules> {
    return withDefaultRules(await this.repository.findSettings(madrasaId));
  }

  async getSettings(madrasaId: number) {
    return toSettingsDto(await this.getRules(madrasaId));
  }

  async updateSettings(madrasaId: number, dto: UpdateSettingsDto) {
    const current = await this.getRules(madrasaId);
    const next: DeviceRules = { ...current };
    if (dto.late_enabled !== undefined) next.lateEnabled = dto.late_enabled;
    if (dto.student_start_time !== undefined) next.studentStartTime = dto.student_start_time;
    if (dto.teacher_start_time !== undefined) next.teacherStartTime = dto.teacher_start_time;
    if (dto.late_grace_minutes !== undefined) next.lateGraceMinutes = dto.late_grace_minutes;
    if (dto.auto_absent_enabled !== undefined) next.autoAbsentEnabled = dto.auto_absent_enabled;
    if (dto.absent_cutoff_time !== undefined) next.absentCutoffTime = dto.absent_cutoff_time;
    if (dto.checkout_enabled !== undefined) next.checkoutEnabled = dto.checkout_enabled;
    if (dto.checkout_after_time !== undefined) next.checkoutAfterTime = dto.checkout_after_time;
    if (dto.weekly_off_days !== undefined) next.weeklyOffDays = [...dto.weekly_off_days].sort((a, b) => a - b);
    if (dto.offline_alert_enabled !== undefined) next.offlineAlertEnabled = dto.offline_alert_enabled;
    if (dto.offline_alert_minutes !== undefined) next.offlineAlertMinutes = dto.offline_alert_minutes;
    if (dto.alert_phone !== undefined) next.alertPhone = dto.alert_phone ? dto.alert_phone : null;
    if (dto.auto_time_sync !== undefined) next.autoTimeSync = dto.auto_time_sync;
    if (dto.pin_start !== undefined) next.pinStart = dto.pin_start;
    if (dto.pin_mode !== undefined) next.pinMode = dto.pin_mode;

    // lastAutoAbsentDate is owned by the auto-absent job, never by the admin.
    const { lastAutoAbsentDate: _ignored, ...data } = next;
    const saved = await this.repository.upsertSettings(madrasaId, data);
    logger.info("Attendance device settings updated", { madrasaId, fields: Object.keys(dto) });
    return toSettingsDto(withDefaultRules(saved));
  }

  /* ================= holidays ================= */

  async listHolidays(madrasaId: number, year?: number) {
    const y = year ?? Number(localDateString(this.now(), env.attendanceTimezone).slice(0, 4));
    const rows = await this.repository.listHolidays(madrasaId, dateOnly(`${y}-01-01`), dateOnly(`${y + 1}-01-01`));
    return rows.map(toHolidayDto);
  }

  async createHoliday(madrasaId: number, dto: CreateHolidayDto) {
    if (!isValidDateString(dto.date)) {
      throw new BadRequestError(t({ bn: "তারিখ অবশ্যই YYYY-MM-DD ফরম্যাটে হতে হবে", en: "date must be YYYY-MM-DD" }));
    }
    try {
      const row = await this.repository.createHoliday(madrasaId, dateOnly(dto.date), dto.title);
      logger.info("Attendance holiday created", { madrasaId, date: dto.date });
      return toHolidayDto(row);
    } catch (err) {
      if ((err as { code?: string })?.code === "P2002") {
        throw new ConflictError(t({ bn: "এই তারিখে ইতিমধ্যে একটি ছুটি আছে", en: "A holiday already exists on this date" }));
      }
      throw err;
    }
  }

  async deleteHoliday(madrasaId: number, id: number) {
    const res = await this.repository.deleteHoliday(madrasaId, id);
    if (res.count === 0) throw new NotFoundError(t({ bn: "ছুটি পাওয়া যায়নি", en: "Holiday not found" }));
  }

  /* ================= rule helpers for ingest / jobs / reports ================= */

  async dayInfo(madrasaId: number, dateStr: string, rules?: DeviceRules): Promise<DayInfo> {
    const holiday = await this.repository.findHoliday(madrasaId, dateOnly(dateStr));
    if (holiday) return { off: true, reason: "holiday", holidayTitle: holiday.title };
    const r = rules ?? (await this.getRules(madrasaId));
    if (isWeeklyOff(r, dateStr)) return { off: true, reason: "weekly_off", holidayTitle: null };
    return { off: false, reason: null, holidayTitle: null };
  }

  /** Per-request cache: rules loaded once, each local date checked once. */
  rulesLoader(madrasaId: number) {
    let rules: Promise<DeviceRules> | null = null;
    const days = new Map<string, Promise<DayInfo>>();
    const getRules = () => (rules ??= this.getRules(madrasaId));
    return {
      rules: getRules,
      day: (dateStr: string) => {
        let p = days.get(dateStr);
        if (!p) {
          p = getRules().then((r) => this.dayInfo(madrasaId, dateStr, r));
          days.set(dateStr, p);
        }
        return p;
      },
    };
  }
}

export type RulesLoader = ReturnType<AttendanceDeviceSettingsService["rulesLoader"]>;

export const attendanceDeviceSettingsService = new AttendanceDeviceSettingsService();
