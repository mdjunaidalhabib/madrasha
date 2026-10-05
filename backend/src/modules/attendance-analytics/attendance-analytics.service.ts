import type { AttendanceStatus, AttendeeType } from "@prisma/client";
import { env } from "../../shared/config/env";
import { BadRequestError } from "../../shared/errors";
import { t } from "../../shared/i18n";
import { tenantClassName } from "../../shared/utils/tenant-name.util";
import {
  attendanceCalendar,
  dateOnly,
  eachDate,
  isValidDateString,
  monthBounds,
  todayLocal,
} from "../attendance/core/attendance-calendar";
import { getPolicy } from "../attendance/core/attendance-policy";
import { statsForAttendees } from "../attendance/core/attendance-stats";
import { attendanceAnalyticsRepository, AttendanceAnalyticsRepository } from "./attendance-analytics.repository";
import {
  LowAttendanceQueryDto,
  OverviewQueryDto,
  PayrollApplyRequestDto,
  PayrollSummaryQueryDto,
  TrendQueryDto,
} from "./attendance-analytics.dto";
import {
  averageCheckIn,
  bucketTrend,
  deductibleDays,
  netAmount,
  perDaySalary,
  round2,
  suggestedDeduction,
  totalsFor,
  workedMinutes,
} from "./attendance-analytics.helpers";

const ATTENDEE_TYPES: AttendeeType[] = ["STUDENT", "TEACHER", "STAFF"];
const MAX_RANGE_DAYS = 366;
const MAX_APPLY_ITEMS = 1000;

const parseType = (value: unknown, fallback: AttendeeType, allowed: AttendeeType[] = ATTENDEE_TYPES): AttendeeType => {
  if (value === undefined || value === null || value === "") return fallback;
  const v = String(value).toUpperCase() as AttendeeType;
  if (!allowed.includes(v)) {
    throw new BadRequestError(
      t({ bn: `attendee_type অবশ্যই ${allowed.join(", ")} হতে হবে`, en: `attendee_type must be one of ${allowed.join(", ")}` }),
    );
  }
  return v;
};

const optionalId = (value: unknown, label: string): number | null => {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new BadRequestError(t({ bn: `${label} সঠিক নয়`, en: `${label} is invalid` }));
  return n;
};

const parseDate = (value: unknown, label: string, fallback?: string): string => {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) {
    if (fallback) return fallback;
    throw new BadRequestError(t({ bn: `${label} আবশ্যক`, en: `${label} is required` }));
  }
  if (!isValidDateString(s)) {
    throw new BadRequestError(
      t({ bn: `${label} অবশ্যই YYYY-MM-DD ফরম্যাটে হতে হবে`, en: `${label} must be in YYYY-MM-DD format` }),
    );
  }
  return s;
};

const parseMonth = (value: unknown, fallbackToCurrent: boolean): { month: string; from: string; to: string } => {
  const raw = typeof value === "string" && value.trim() ? value.trim() : fallbackToCurrent ? todayLocal().slice(0, 7) : "";
  const bounds = raw ? monthBounds(raw) : null;
  if (!bounds) {
    throw new BadRequestError(t({ bn: "month অবশ্যই YYYY-MM ফরম্যাটে হতে হবে", en: "month must be in YYYY-MM format" }));
  }
  return { month: raw, ...bounds };
};

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export class AttendanceAnalyticsService {
  constructor(private readonly repository: AttendanceAnalyticsRepository = attendanceAnalyticsRepository) {}

  /* ---------------- overview ---------------- */

  async overview(madrasaId: number, query: OverviewQueryDto) {
    const date = parseDate(query.date, "date", todayLocal());

    const [off, students, teacherIds, staffIds, rows] = await Promise.all([
      attendanceCalendar.offDay(madrasaId, date),
      this.repository.studentIds(madrasaId),
      this.repository.staffIds(madrasaId, "TEACHER"),
      this.repository.staffIds(madrasaId, "STAFF"),
      this.repository.dayRows(madrasaId, dateOnly(date)),
    ]);

    const statusOf: Record<AttendeeType, Map<number, AttendanceStatus>> = {
      STUDENT: new Map(),
      TEACHER: new Map(),
      STAFF: new Map(),
    };
    for (const r of rows) statusOf[r.attendeeType].set(r.attendeeId, r.status);

    const studentIdsByClass = new Map<number, number[]>();
    for (const s of students) {
      const list = studentIdsByClass.get(s.classId) ?? [];
      list.push(s.id);
      studentIdsByClass.set(s.classId, list);
    }
    const classRows = await this.repository.classes(madrasaId, [...studentIdsByClass.keys()]);
    const classes = classRows
      .map((c) => ({ c, order: c.madrasaClasses[0]?.sortOrder ?? c.sortOrder }))
      .sort((a, b) => a.order - b.order || a.c.id - b.c.id)
      .map(({ c }) => ({
        class_id: c.id,
        class_name: tenantClassName(c),
        ...totalsFor(studentIdsByClass.get(c.id) ?? [], statusOf.STUDENT),
      }));

    return {
      date,
      off_day: off ? { reason: off.reason, title: off.title } : null,
      students: totalsFor(students.map((s) => s.id), statusOf.STUDENT),
      teachers: totalsFor(teacherIds, statusOf.TEACHER),
      staff: totalsFor(staffIds, statusOf.STAFF),
      classes,
    };
  }

  /* ---------------- trend ---------------- */

  private async populationIds(madrasaId: number, type: AttendeeType, classId: number | null): Promise<number[]> {
    if (type === "STUDENT") return (await this.repository.studentIds(madrasaId, classId)).map((s) => s.id);
    return this.repository.staffIds(madrasaId, type);
  }

  async trend(madrasaId: number, query: TrendQueryDto) {
    const { from, to } = parseMonth(query.month, true);
    const type = parseType(query.attendee_type, "STUDENT");
    const classId = type === "STUDENT" ? optionalId(query.class_id, "class_id") : null;
    const today = todayLocal();
    const end = to > today ? today : to;
    if (from > end) return [];

    const [calendar, ids] = await Promise.all([
      attendanceCalendar.range(madrasaId, from, end),
      this.populationIds(madrasaId, type, classId),
    ]);
    const grouped = await this.repository.trendCounts(madrasaId, type, ids, dateOnly(from), dateOnly(end));
    return bucketTrend(
      eachDate(from, end),
      new Set(calendar.offDays.map((o) => o.date)),
      grouped.map((g) => ({ date: isoDate(g.date), status: g.status, count: g._count._all })),
      ids.length,
    );
  }

  /* ---------------- low attendance ---------------- */

  async lowAttendance(madrasaId: number, query: LowAttendanceQueryDto) {
    const today = todayLocal();
    const to = parseDate(query.to, "to", today);
    const from = parseDate(query.from, "from", `${to.slice(0, 7)}-01`);
    if (from > to) throw new BadRequestError(t({ bn: "from অবশ্যই to-এর আগে হতে হবে", en: "from must not be after to" }));
    if (dateOnly(to).getTime() - dateOnly(from).getTime() > (MAX_RANGE_DAYS - 1) * 86_400_000) {
      throw new BadRequestError(t({ bn: "সর্বোচ্চ ৩৬৬ দিনের সময়সীমা দেখা যাবে", en: "The range can be at most 366 days" }));
    }
    const type = parseType(query.attendee_type, "STUDENT");
    const classId = type === "STUDENT" ? optionalId(query.class_id, "class_id") : null;

    const policy = await getPolicy(madrasaId);
    let threshold = policy.lowAttendancePercent;
    if (query.threshold !== undefined && query.threshold !== "") {
      const n = Number(query.threshold);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        throw new BadRequestError(t({ bn: "threshold ০ থেকে ১০০-এর মধ্যে হতে হবে", en: "threshold must be between 0 and 100" }));
      }
      threshold = n;
    }

    const people = await this.repository.people(madrasaId, type, classId);
    const stats = await statsForAttendees(madrasaId, type, people.map((p) => p.id), from, to, { policy });

    const rows = people
      .map((p) => ({ p, s: stats.get(p.id)! }))
      // No counted day = no data, not "0 %".
      .filter(({ s }) => s && s.counted_days > 0 && s.percentage < threshold)
      .sort((a, b) => a.s.percentage - b.s.percentage || a.p.name.localeCompare(b.p.name))
      .map(({ p, s }) => ({
        attendee_id: p.id,
        name: p.name,
        ...(type === "STUDENT"
          ? { class_id: p.classId, class_name: p.className, roll: p.roll, guardian_phone: p.guardianPhone }
          : { designation: p.designation }),
        ...s,
      }));

    return { from, to: to > today ? today : to, threshold, rows };
  }

  /* ---------------- payroll ---------------- */

  async payrollSummary(madrasaId: number, query: PayrollSummaryQueryDto) {
    const { month, from, to } = parseMonth(query.month, false);
    const type = parseType(query.attendee_type, "TEACHER", ["TEACHER", "STAFF"]);

    const [policy, calendar, people] = await Promise.all([
      getPolicy(madrasaId),
      attendanceCalendar.range(madrasaId, from, to),
      this.repository.people(madrasaId, type),
    ]);
    const ids = people.map((p) => p.id);
    const workingDays = calendar.workingDays.length;

    const [stats, checkRows, payroll] = await Promise.all([
      statsForAttendees(madrasaId, type, ids, from, to, { policy }),
      this.repository.checkTimes(madrasaId, type, ids, dateOnly(from), dateOnly(to)),
      type === "TEACHER" ? this.repository.payrollRecords(madrasaId, month, ids) : Promise.resolve([]),
    ]);

    const checksById = new Map<number, typeof checkRows>();
    for (const r of checkRows) {
      const list = checksById.get(r.attendeeId) ?? [];
      list.push(r);
      checksById.set(r.attendeeId, list);
    }
    const payrollById = new Map(payroll.map((p) => [p.teacherId, p]));

    const rows = people.map((p) => {
      const s = stats.get(p.id)!;
      const record = payrollById.get(p.id);
      // The generated payroll's basic salary is what the deduction applies to; else the profile salary.
      const base = record ? Number(record.basicSalary) : p.salary;
      const checks = checksById.get(p.id) ?? [];
      const days = deductibleDays(s, policy.leaveMode);
      return {
        attendee_id: p.id,
        name: p.name,
        designation: p.designation,
        salary: p.salary,
        present: s.PRESENT,
        late: s.LATE,
        absent: s.ABSENT,
        leave: s.LEAVE,
        unmarked: s.unmarked,
        late_penalty: s.late_penalty,
        percentage: s.percentage,
        worked_minutes: workedMinutes(checks),
        avg_check_in: averageCheckIn(
          checks.map((c) => c.checkInAt),
          env.attendanceTimezone,
        ),
        per_day_salary: perDaySalary(base, workingDays),
        deductible_days: days,
        suggested_deduction: suggestedDeduction(base, workingDays, days, policy.payrollDeductAbsent),
        payroll: record
          ? {
              id: record.id,
              status: record.status,
              basic_salary: Number(record.basicSalary),
              allowances: Number(record.allowances),
              deductions: Number(record.deductions),
              net_amount: Number(record.netAmount),
            }
          : null,
      };
    });

    return {
      month,
      attendee_type: type,
      working_days: workingDays,
      deduct_absent: policy.payrollDeductAbsent,
      leave_mode: policy.leaveMode,
      rows,
    };
  }

  async payrollApply(madrasaId: number, dto: PayrollApplyRequestDto) {
    const { month } = parseMonth(dto?.month, false);
    if (!Array.isArray(dto.items) || dto.items.length === 0) {
      throw new BadRequestError(t({ bn: "items একটি খালি নয় এমন তালিকা হতে হবে", en: "items must be a non-empty array" }));
    }
    if (dto.items.length > MAX_APPLY_ITEMS) {
      throw new BadRequestError(t({ bn: "একবারে সর্বোচ্চ ১০০০টি আইটেম", en: "At most 1000 items per request" }));
    }

    const deductionByTeacher = new Map<number, number>();
    for (const item of dto.items) {
      const teacherId = optionalId(item?.teacher_id, "teacher_id");
      if (!teacherId) throw new BadRequestError(t({ bn: "teacher_id আবশ্যক", en: "teacher_id is required" }));
      const deduction = Number(item.deduction);
      if (item.deduction === undefined || item.deduction === null || item.deduction === "" || !Number.isFinite(deduction) || deduction < 0) {
        throw new BadRequestError(
          t({ bn: "কর্তনের পরিমাণ অবশ্যই ঋণাত্মক নয় এমন সংখ্যা হতে হবে", en: "deduction must be a non-negative number" }),
        );
      }
      deductionByTeacher.set(teacherId, round2(deduction));
    }

    const records = await this.repository.payrollRecords(madrasaId, month, [...deductionByTeacher.keys()]);
    const recordByTeacher = new Map(records.map((r) => [r.teacherId, r]));

    const skipped: Array<{ teacher_id: number; reason: "no_record" | "not_pending" | "exceeds_salary" }> = [];
    const updates: Array<{ id: number; deductions: number; netAmount: number }> = [];
    for (const [teacherId, deduction] of deductionByTeacher) {
      const record = recordByTeacher.get(teacherId);
      if (!record) {
        skipped.push({ teacher_id: teacherId, reason: "no_record" });
        continue;
      }
      if (record.status !== "PENDING") {
        skipped.push({ teacher_id: teacherId, reason: "not_pending" });
        continue;
      }
      const net = netAmount(Number(record.basicSalary), Number(record.allowances), deduction);
      if (net < 0) {
        skipped.push({ teacher_id: teacherId, reason: "exceeds_salary" });
        continue;
      }
      updates.push({ id: record.id, deductions: deduction, netAmount: net });
    }

    const updated = updates.length ? await this.repository.applyDeductions(updates) : 0;
    // A record that turned PAID between the read and the write is not rewritten.
    const raced = updates.length - updated;
    return { month, updated, skipped: skipped.length + raced, skipped_items: skipped };
  }
}

export const attendanceAnalyticsService = new AttendanceAnalyticsService();
