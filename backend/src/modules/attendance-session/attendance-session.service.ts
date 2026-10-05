import type { AttendanceSession, AttendanceStatus, Prisma } from "@prisma/client";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../shared/errors";
import { t } from "../../shared/i18n";
import { tenantClassName } from "../../shared/utils/tenant-name.util";
import { attendanceCalendar, dateOnly, isValidDateString, todayLocal } from "../attendance/core/attendance-calendar";
import { getPolicy } from "../attendance/core/attendance-policy";
import type { StatusCounts } from "../attendance/core/attendance-stats";
import { attendanceSessionRepository, AttendanceSessionRepository, SheetStudentRow } from "./attendance-session.repository";
import {
  CreateSessionRequestDto,
  SessionListQueryDto,
  SessionMarkRequestDto,
  SessionReportQueryDto,
  SessionSheetQueryDto,
  UpdateSessionRequestDto,
} from "./attendance-session.dto";
import {
  addCounts,
  emptyCounts,
  isHm,
  markDateProblem,
  parseBool,
  RESIDENTIAL,
  SESSION_STATUSES,
  sessionPercentage,
} from "./attendance-session.rules";

/** Lazily answers "does the caller have attendance.edit" (only asked when needed). */
export type CanEditPast = () => Promise<boolean>;

const MAX_REPORT_DAYS = 366;
const MAX_MARK_ENTRIES = 2000;

const toSessionDto = (s: AttendanceSession, recordCount?: number) => ({
  id: s.id,
  name: s.name,
  start_time: s.startTime,
  end_time: s.endTime,
  residential_only: s.residentialOnly,
  sort_order: s.sortOrder,
  is_active: s.isActive,
  ...(recordCount !== undefined ? { record_count: recordCount } : {}),
});

const positiveInt = (value: unknown, label: string, required = true): number | null => {
  if (value === undefined || value === null || value === "") {
    if (required) throw new BadRequestError(t({ bn: `${label} আবশ্যক`, en: `${label} is required` }));
    return null;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new BadRequestError(t({ bn: `${label} সঠিক নয়`, en: `${label} is invalid` }));
  return n;
};

const requireDate = (value: unknown, label: string): string => {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) throw new BadRequestError(t({ bn: `${label} আবশ্যক`, en: `${label} is required` }));
  if (!isValidDateString(s)) {
    throw new BadRequestError(
      t({ bn: `${label} অবশ্যই YYYY-MM-DD ফরম্যাটে হতে হবে`, en: `${label} must be in YYYY-MM-DD format` }),
    );
  }
  return s;
};

const optionalHm = (value: unknown, label: string): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const s = String(value).trim();
  if (!isHm(s)) {
    throw new BadRequestError(t({ bn: `${label} অবশ্যই HH:mm ফরম্যাটে হতে হবে`, en: `${label} must be in HH:mm format` }));
  }
  return s;
};

const studentName = (s: SheetStudentRow) => s.nameBn || s.nameEn || `#${s.id}`;

export class AttendanceSessionService {
  constructor(private readonly repository: AttendanceSessionRepository = attendanceSessionRepository) {}

  /* ---------------- session CRUD ---------------- */

  async list(madrasaId: number, query: SessionListQueryDto) {
    const sessions = await this.repository.list(madrasaId, parseBool(query.include_inactive) === true);
    const counts = await this.repository.recordCounts(madrasaId, sessions.map((s) => s.id));
    return sessions.map((s) => toSessionDto(s, counts.get(s.id) ?? 0));
  }

  private parseSessionBody(dto: CreateSessionRequestDto, creating: boolean) {
    const data: Prisma.AttendanceSessionUncheckedUpdateInput = {};
    if (creating || dto.name !== undefined) {
      const name = String(dto.name ?? "").trim();
      if (!name) throw new BadRequestError(t({ bn: "সেশনের নাম আবশ্যক", en: "Session name is required" }));
      if (name.length > 100) {
        throw new BadRequestError(t({ bn: "সেশনের নাম সর্বোচ্চ ১০০ অক্ষর", en: "Session name must be at most 100 characters" }));
      }
      data.name = name;
    }
    const start = optionalHm(dto.start_time, "start_time");
    const end = optionalHm(dto.end_time, "end_time");
    if (start !== undefined) data.startTime = start;
    if (end !== undefined) data.endTime = end;
    if (dto.residential_only !== undefined) {
      const v = parseBool(dto.residential_only);
      if (v === undefined) throw new BadRequestError(t({ bn: "residential_only সঠিক নয়", en: "residential_only is invalid" }));
      data.residentialOnly = v;
    }
    if (dto.is_active !== undefined) {
      const v = parseBool(dto.is_active);
      if (v === undefined) throw new BadRequestError(t({ bn: "is_active সঠিক নয়", en: "is_active is invalid" }));
      data.isActive = v;
    }
    if (dto.sort_order !== undefined && dto.sort_order !== null && dto.sort_order !== "") {
      const n = Number(dto.sort_order);
      if (!Number.isInteger(n) || n < 0 || n > 100000) {
        throw new BadRequestError(t({ bn: "sort_order সঠিক নয়", en: "sort_order is invalid" }));
      }
      data.sortOrder = n;
    }
    return data;
  }

  private async requireSession(madrasaId: number, id: number) {
    const session = await this.repository.findById(madrasaId, id);
    if (!session) throw new NotFoundError(t({ bn: "সেশন পাওয়া যায়নি", en: "Session not found" }));
    return session;
  }

  async create(madrasaId: number, dto: CreateSessionRequestDto) {
    const data = this.parseSessionBody(dto, true);
    const created = await this.repository.create({
      ...(data as Omit<Prisma.AttendanceSessionUncheckedCreateInput, "madrasaId">),
      madrasaId,
    });
    return toSessionDto(created, 0);
  }

  async update(madrasaId: number, id: number, dto: UpdateSessionRequestDto) {
    await this.requireSession(madrasaId, id);
    const updated = await this.repository.update(id, this.parseSessionBody(dto, false));
    return toSessionDto(updated);
  }

  async remove(madrasaId: number, id: number, force: boolean) {
    await this.requireSession(madrasaId, id);
    const records = (await this.repository.recordCounts(madrasaId, [id])).get(id) ?? 0;
    if (records > 0 && !force) {
      throw new ConflictError(
        t({
          bn: `এই সেশনে ${records}টি হাজিরা রেকর্ড আছে। মুছে ফেলার বদলে নিষ্ক্রিয় করুন।`,
          en: `This session has ${records} attendance records. Deactivate it instead.`,
        }),
        { code: "has_records", records },
      );
    }
    await this.repository.delete(id);
    return { id, deleted_records: records };
  }

  /* ---------------- date rules ---------------- */

  /** Same rules as /attendance/bulk: no future date, window -> attendance.edit, off day -> 400. */
  private async assertMarkable(madrasaId: number, date: string, canEditPast: CanEditPast) {
    const policy = await getPolicy(madrasaId);
    const problem = markDateProblem(date, todayLocal(), policy.editWindowDays);
    if (problem === "future_date") {
      throw new BadRequestError(
        t({ bn: "ভবিষ্যতের তারিখে হাজিরা দেওয়া যাবে না", en: "Attendance cannot be marked for a future date" }),
        { code: "future_date" },
      );
    }
    if (problem === "outside_window" && !(await canEditPast())) {
      throw new ForbiddenError(
        t({
          bn: `${policy.editWindowDays} দিনের বেশি পুরনো হাজিরা পরিবর্তনের অনুমতি নেই (attendance.edit প্রয়োজন)`,
          en: `Changing attendance older than ${policy.editWindowDays} days needs the attendance.edit permission`,
        }),
      );
    }
    const off = await attendanceCalendar.offDay(madrasaId, date);
    if (off) {
      throw new BadRequestError(
        t({ bn: "এই দিনটি ছুটির দিন, হাজিরা দেওয়া যাবে না", en: "This date is an off day; attendance cannot be marked" }),
        { code: "off_day", reason: off.reason, title: off.title },
      );
    }
  }

  /* ---------------- sheet + mark ---------------- */

  async sheet(madrasaId: number, query: SessionSheetQueryDto, canEditPast: CanEditPast) {
    const sessionId = positiveInt(query.session_id, "session_id")!;
    const classId = positiveInt(query.class_id, "class_id")!;
    const date = requireDate(query.date, "date");
    const session = await this.requireSession(madrasaId, sessionId);

    const [policy, off, students] = await Promise.all([
      getPolicy(madrasaId),
      attendanceCalendar.offDay(madrasaId, date),
      this.repository.findStudents(madrasaId, { classId, residentialOnly: session.residentialOnly }),
    ]);
    const marks = await this.repository.findMarks(madrasaId, sessionId, dateOnly(date), students.map((s) => s.id));
    const markByStudent = new Map(marks.map((m) => [m.studentId, m]));

    const problem = markDateProblem(date, todayLocal(), policy.editWindowDays);
    const editable =
      session.isActive && !off && problem !== "future_date" && (problem === null || (await canEditPast()));

    return {
      session: toSessionDto(session),
      date,
      off_day: off ? { reason: off.reason, title: off.title } : null,
      editable,
      students: students.map((s) => {
        const m = markByStudent.get(s.id);
        return {
          student_id: s.id,
          name: studentName(s),
          roll: s.roll,
          class_id: s.classId,
          residency_type: s.residencyType,
          status: m?.status ?? null,
          remarks: m?.remarks ?? null,
        };
      }),
    };
  }

  async mark(
    madrasaId: number,
    markedById: number | undefined,
    dto: SessionMarkRequestDto,
    canEditPast: CanEditPast,
  ) {
    const sessionId = positiveInt(dto.session_id, "session_id")!;
    const classId = positiveInt(dto.class_id, "class_id", false);
    const date = requireDate(dto.date, "date");
    if (!Array.isArray(dto.entries) || dto.entries.length === 0) {
      throw new BadRequestError(t({ bn: "entries একটি খালি নয় এমন তালিকা হতে হবে", en: "entries must be a non-empty array" }));
    }
    if (dto.entries.length > MAX_MARK_ENTRIES) {
      throw new BadRequestError(t({ bn: "একবারে সর্বোচ্চ ২০০০টি এন্ট্রি দেওয়া যাবে", en: "At most 2000 entries per request" }));
    }

    const entries = new Map<number, { status: AttendanceStatus; remarks: string | null }>();
    for (const entry of dto.entries) {
      const studentId = positiveInt(entry?.student_id, "student_id")!;
      const status = String(entry?.status || "").toUpperCase();
      if (!SESSION_STATUSES.includes(status as (typeof SESSION_STATUSES)[number])) {
        throw new BadRequestError(
          t({
            bn: `ছাত্র ${studentId}-এর জন্য "${entry?.status}" স্ট্যাটাসটি সঠিক নয়`,
            en: `Invalid status "${entry?.status}" for student ${studentId}`,
          }),
        );
      }
      const remarks = typeof entry.remarks === "string" ? entry.remarks.trim().slice(0, 255) || null : null;
      entries.set(studentId, { status: status as AttendanceStatus, remarks });
    }

    const session = await this.requireSession(madrasaId, sessionId);
    if (!session.isActive) {
      throw new BadRequestError(t({ bn: "সেশনটি নিষ্ক্রিয়", en: "This session is inactive" }), { code: "session_inactive" });
    }
    await this.assertMarkable(madrasaId, date, canEditPast);

    const ids = [...entries.keys()];
    const students = await this.repository.findStudents(madrasaId, {
      ids,
      classId,
      residentialOnly: session.residentialOnly,
    });
    const studentById = new Map(students.map((s) => [s.id, s]));
    // Unknown / inactive / other-class / non-residential (for a residential session) students.
    const skipped = ids.filter((id) => !studentById.has(id));
    const validIds = ids.filter((id) => studentById.has(id));

    const day = dateOnly(date);
    const existing = await this.repository.findMarks(madrasaId, sessionId, day, validIds);
    const existingByStudent = new Map(existing.map((e) => [e.studentId, e]));

    const creates: Prisma.SessionAttendanceCreateManyInput[] = [];
    const updates: Parameters<AttendanceSessionRepository["saveMarks"]>[1] = [];
    let unchanged = 0;
    for (const id of validIds) {
      const e = entries.get(id)!;
      const cls = studentById.get(id)!.classId ?? null;
      const prev = existingByStudent.get(id);
      if (!prev) {
        creates.push({
          madrasaId,
          sessionId,
          studentId: id,
          classId: cls,
          date: day,
          status: e.status,
          remarks: e.remarks,
          markedById: markedById ?? null,
        });
      } else if (prev.status !== e.status || (prev.remarks ?? null) !== e.remarks) {
        updates.push({ id: prev.id, status: e.status, remarks: e.remarks, markedById: markedById ?? null, classId: cls });
      } else {
        unchanged += 1;
      }
    }

    await this.repository.saveMarks(creates, updates);
    return {
      saved_count: creates.length + updates.length,
      created: creates.length,
      updated: updates.length,
      unchanged,
      skipped,
    };
  }

  /* ---------------- report ---------------- */

  async report(madrasaId: number, query: SessionReportQueryDto) {
    const from = requireDate(query.from, "from");
    const to = requireDate(query.to, "to");
    if (from > to) throw new BadRequestError(t({ bn: "from অবশ্যই to-এর আগে হতে হবে", en: "from must not be after to" }));
    const spanDays = (dateOnly(to).getTime() - dateOnly(from).getTime()) / 86_400_000 + 1;
    if (spanDays > MAX_REPORT_DAYS) {
      throw new BadRequestError(t({ bn: "সর্বোচ্চ ৩৬৬ দিনের রিপোর্ট দেখা যাবে", en: "The report range can be at most 366 days" }));
    }
    const classId = positiveInt(query.class_id, "class_id", false);
    const sessionId = positiveInt(query.session_id, "session_id", false);

    const sessions = sessionId
      ? await this.repository.findByIds(madrasaId, [sessionId])
      : await this.repository.list(madrasaId, false);
    if (sessionId && !sessions.length) throw new NotFoundError(t({ bn: "সেশন পাওয়া যায়নি", en: "Session not found" }));

    const [policy, students] = await Promise.all([
      getPolicy(madrasaId),
      this.repository.findStudents(madrasaId, {
        classId,
        // Only residential students matter when every listed session is residential-only.
        residentialOnly: sessions.length > 0 && sessions.every((s) => s.residentialOnly),
      }),
    ]);
    const grouped = await this.repository.reportCounts(
      madrasaId,
      dateOnly(from),
      dateOnly(to),
      sessions.map((s) => s.id),
      students.map((s) => s.id),
    );

    const counts = new Map<string, StatusCounts>();
    for (const g of grouped) {
      const key = `${g.studentId}:${g.sessionId}`;
      const c = counts.get(key) ?? emptyCounts();
      c[g.status as keyof StatusCounts] = g._count._all;
      counts.set(key, c);
    }

    const rows = students.map((s) => {
      const perSession: Record<number, StatusCounts & { total: number; percentage: number }> = {};
      let overall = emptyCounts();
      for (const session of sessions) {
        if (session.residentialOnly && s.residencyType !== RESIDENTIAL) continue;
        const c = counts.get(`${s.id}:${session.id}`) ?? emptyCounts();
        overall = addCounts(overall, c);
        perSession[session.id] = { ...c, ...sessionPercentage(c, policy) };
      }
      const overallStats = sessionPercentage(overall, policy);
      return {
        student_id: s.id,
        name: studentName(s),
        roll: s.roll,
        class_id: s.classId,
        class_name: tenantClassName(s.classRef),
        residency_type: s.residencyType,
        per_session: perSession,
        overall_total: overallStats.total,
        overall_percentage: overallStats.percentage,
      };
    });

    return { from, to, sessions: sessions.map((s) => toSessionDto(s)), rows };
  }
}

export const attendanceSessionService = new AttendanceSessionService();
