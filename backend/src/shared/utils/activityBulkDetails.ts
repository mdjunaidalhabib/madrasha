import { prisma } from "../database/prisma";
import { describeStudentsByClass, loadAcademicNames } from "./activityDetails";

/**
 * Detail text for the auto-logged bulk routes (activityLogger.middleware.ts).
 *
 * A bulk request is ONE log row, never one per record. Its details are a
 * headline (what was done, with counts), then the affected people grouped the
 * way staff think about them - students by class, teachers by division,
 * attendance/promotion by status - each person on an indented line (the admin
 * UI nests those under the group line).
 *
 * `before` runs ahead of the handler (for routes whose change can only be
 * shown against the old values, e.g. the names page). It reads by id alone -
 * the tenant isn't resolved yet - so `describe` keeps only this madrasa's rows.
 */

const EMPTY = "—";

type BulkContext = {
  madrasaId: number;
  body: any;
  /** The JSON the handler sent back (counts, per-row preview). */
  response: any;
  before: unknown;
};

type BulkDescriber = {
  before?: (body: any) => Promise<unknown>;
  describe: (ctx: BulkContext) => Promise<string | null>;
};

const ids = (values: unknown[]): number[] =>
  [...new Set(values.map(Number).filter((id) => Number.isInteger(id) && id > 0))];

const list = (value: unknown): any[] => (Array.isArray(value) ? value : []);

const dateText = (value: unknown) => {
  if (!value) return EMPTY;
  const d = value instanceof Date ? value : new Date(String(value));
  return isNaN(d.getTime()) ? String(value) : d.toISOString().slice(0, 10);
};

const money = (value: unknown) => `৳${Number(value || 0).toLocaleString("en-US")}`;

/** "• <group> — N জন" + an indented numbered line per person, per group. */
const groupedLines = (groups: Array<{ label: string; people: string[] }>) =>
  groups
    .filter((g) => g.people.length)
    .flatMap((g) => [`• ${g.label} — ${g.people.length} জন`, ...g.people.map((p, i) => `    ${i + 1}. ${p}`)]);

const withExtras = (name: string, extras: Array<string | null | undefined>) => {
  const shown = extras.filter(Boolean);
  return shown.length ? `${name} (${shown.join(", ")})` : name;
};

/* ================= PEOPLE LOOKUPS ================= */

const studentNames = async (madrasaId: number, studentIds: number[]) => {
  const rows = await prisma.student.findMany({
    where: { madrasaId, id: { in: studentIds } },
    select: { id: true, nameBn: true, roll: true },
  });
  return new Map(rows.map((s) => [s.id, withExtras(s.nameBn, [s.roll != null ? `রোল: ${s.roll}` : null])]));
};

const teacherNames = async (madrasaId: number, teacherIds: number[]) => {
  const rows = await prisma.teacher.findMany({
    where: { madrasaId, id: { in: teacherIds } },
    select: { id: true, nameBn: true, designation: true },
  });
  return new Map(rows.map((t) => [t.id, withExtras(t.nameBn, [t.designation])]));
};

const staffNames = async (madrasaId: number, staffIds: number[]) => {
  const rows = await prisma.staff.findMany({
    where: { madrasaId, id: { in: staffIds } },
    select: { id: true, nameBn: true },
  });
  return new Map(rows.map((s) => [s.id, s.nameBn]));
};

/** Teachers grouped by বিভাগ, with an optional per-teacher note. */
export const describeTeachersByDivision = async (
  madrasaId: number,
  teacherIds: number[],
  headline: string,
  notes?: Map<number, string>,
) => {
  const teachers = await prisma.teacher.findMany({
    where: { madrasaId, id: { in: teacherIds } },
    select: { id: true, nameBn: true, designation: true, divisionId: true },
    orderBy: { id: "asc" },
  });
  const divisionIds = [...new Set(teachers.map((t) => t.divisionId))];
  const names = await loadAcademicNames(madrasaId, [], divisionIds);
  return [
    headline,
    ...groupedLines(
      divisionIds.map((divisionId) => ({
        label: `বিভাগ: ${names.divisions.get(divisionId) ?? EMPTY}`,
        people: teachers
          .filter((t) => t.divisionId === divisionId)
          .map((t) => withExtras(t.nameBn, [t.designation, notes?.get(t.id)])),
      })),
    ),
  ].join("\n");
};

/** Groups `entries` by status (in `order`) and names each person. */
const byStatus = (
  entries: Array<{ id: number; status: string }>,
  names: Map<number, string>,
  labels: Record<string, string>,
) => {
  const order = Object.keys(labels);
  const statuses = [...new Set(entries.map((e) => e.status))].sort(
    (a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99),
  );
  return groupedLines(
    statuses.map((status) => ({
      label: labels[status] ?? status,
      people: entries.filter((e) => e.status === status).map((e) => names.get(e.id) ?? `আইডি ${e.id}`),
    })),
  );
};

const countsText = (entries: Array<{ status: string }>, labels: Record<string, string>) =>
  Object.entries(labels)
    .map(([status, label]) => [label, entries.filter((e) => e.status === status).length] as const)
    .filter(([, n]) => n > 0)
    .map(([label, n]) => `${label}: ${n}`)
    .join(", ");

/* ================= DESCRIBERS ================= */

const ATTENDANCE_LABELS: Record<string, string> = {
  ABSENT: "অনুপস্থিত",
  LATE: "দেরিতে উপস্থিত",
  LEAVE: "ছুটি",
  PRESENT: "উপস্থিত",
};

const EXAM_ATTENDANCE_LABELS: Record<string, string> = {
  ABSENT: "অনুপস্থিত",
  LATE: "দেরিতে উপস্থিত",
  EXCUSED: "অব্যাহতিপ্রাপ্ত",
  WITHHELD: "স্থগিত",
  PRESENT: "উপস্থিত",
};

const PROMOTION_LABELS: Record<string, string> = {
  PROMOTED: "প্রমোশন পেয়েছে",
  RETAINED: "একই শ্রেণিতে রাখা হয়েছে",
  TRANSFERRED: "স্থানান্তরিত",
};

// Possessive forms - "মোট N জন শিক্ষকের হাজিরা".
const ATTENDEE_OF: Record<string, string> = { STUDENT: "শিক্ষার্থীর", TEACHER: "শিক্ষকের", STAFF: "স্টাফের" };

const TEACHER_FIELD_LABELS: Record<string, string> = {
  nameBn: "নাম (বাংলা)",
  nameAr: "নাম (আরবি)",
  nameEn: "নাম (ইংরেজি)",
  divisionId: "বিভাগ",
  designation: "পদবি",
  department: "বিভাগ/ডিপার্টমেন্ট",
  qualification: "যোগ্যতা",
  phone: "মোবাইল",
  email: "ইমেইল",
  nid: "NID",
  gender: "লিঙ্গ",
  dob: "জন্ম তারিখ",
  joiningDate: "যোগদানের তারিখ",
  salary: "বেতন",
  fatherName: "পিতার নাম",
  motherName: "মাতার নাম",
  isActive: "অবস্থা",
};

const STUDENT_NAME_LABELS: Record<string, string> = {
  nameBn: "নাম (বাংলা)",
  arabicName: "নাম (আরবি)",
  nameEn: "নাম (ইংরেজি)",
  fatherName: "পিতার নাম",
  fatherArabicName: "পিতার নাম (আরবি)",
  fatherNameEn: "পিতার নাম (ইংরেজি)",
  motherName: "মাতার নাম",
  motherArabicName: "মাতার নাম (আরবি)",
  motherNameEn: "মাতার নাম (ইংরেজি)",
};

const showValue = (value: unknown) =>
  value === null || value === undefined || String(value).trim() === ""
    ? EMPTY
    : value instanceof Date
      ? dateText(value)
      : String(value);

const BULK_DESCRIBERS: Record<string, BulkDescriber> = {
  /* ---------- students ---------- */

  // Student list → select → ট্র্যাশে পাঠান
  "students/bulk": {
    describe: async ({ madrasaId, body }) => {
      const studentIds = ids(list(body?.ids));
      if (!studentIds.length) return null;
      return describeStudentsByClass(
        madrasaId,
        studentIds,
        `মোট ${studentIds.length} জন শিক্ষার্থী ট্র্যাশে সরানো হয়েছে`,
      );
    },
  },

  // বাতিল হওয়া আবেদন → select → স্থায়ীভাবে মুছুন. The rows are gone after
  // the handler, so names/classes are read beforehand.
  "students/admission/rejected-bulk": {
    before: (body) =>
      prisma.student.findMany({
        where: { id: { in: ids(list(body?.ids)) } },
        select: { id: true, madrasaId: true, nameBn: true, classId: true, rejectionReason: true },
      }),
    describe: async ({ madrasaId, response, before }) => {
      const done = new Set(ids(list(response?.data?.succeeded)));
      const rows = (before as any[]).filter((s) => s.madrasaId === madrasaId && done.has(s.id));
      if (!rows.length) return null;
      const classIds = [...new Set(rows.map((s) => s.classId as number))];
      const names = await loadAcademicNames(madrasaId, classIds, []);
      const failed = list(response?.data?.failed);
      return [
        `মোট ${rows.length} টি বাতিল হওয়া ভর্তি আবেদন স্থায়ীভাবে মুছে ফেলা হয়েছে` +
          (failed.length ? ` (ব্যর্থ: ${failed.length} টি)` : ""),
        ...groupedLines(
          classIds.map((classId) => ({
            label: `শ্রেণি: ${names.classes.get(classId) ?? EMPTY}`,
            people: rows
              .filter((s) => s.classId === classId)
              .map((s) => withExtras(s.nameBn, [s.rejectionReason ? `বাতিলের কারণ: ${s.rejectionReason}` : null])),
          })),
        ),
      ].join("\n");
    },
  },

  // নাম (৩ ভাষা) page - every changed name as old → new, class-wise.
  "students/names": {
    before: (body) => {
      const studentIds = ids(list(body?.items).map((i) => i?.id));
      return prisma.student.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, madrasaId: true, ...Object.fromEntries(Object.keys(STUDENT_NAME_LABELS).map((k) => [k, true])) },
      });
    },
    describe: async ({ madrasaId, before }) => {
      const old = new Map((before as any[]).filter((s) => s.madrasaId === madrasaId).map((s) => [s.id, s]));
      if (!old.size) return null;
      const now = await prisma.student.findMany({
        where: { madrasaId, id: { in: [...old.keys()] } },
        select: { id: true, ...Object.fromEntries(Object.keys(STUDENT_NAME_LABELS).map((k) => [k, true])) },
      });
      const changes = new Map<number, string[]>();
      for (const s of now as any[]) {
        const prev = old.get(s.id);
        const lines = Object.entries(STUDENT_NAME_LABELS)
          .filter(([field]) => showValue(prev?.[field]) !== showValue(s[field]))
          .map(([field, label]) => `${label}: ${showValue(prev?.[field])} → ${showValue(s[field])}`);
        if (lines.length) changes.set(s.id, lines);
      }
      if (!changes.size) return `মোট ${old.size} জন শিক্ষার্থীর নাম সংরক্ষণ করা হয়েছে — কোনো নাম পরিবর্তন হয়নি`;
      return describeStudentsByClass(
        madrasaId,
        [...changes.keys()],
        `মোট ${changes.size} জন শিক্ষার্থীর নাম হালনাগাদ করা হয়েছে`,
        undefined,
        changes,
      );
    },
  },

  /* ---------- teachers ---------- */

  "teachers/bulk": {
    describe: async ({ madrasaId, response }) => {
      const preview = list(response?.preview);
      if (!preview.length) return null;
      const notes = new Map(
        preview.map((p) => [Number(p.id), p.action === "update" ? "আগে থেকেই ছিল, হালনাগাদ" : "নতুন"] as const),
      );
      const updated = preview.filter((p) => p.action === "update").length;
      return describeTeachersByDivision(
        madrasaId,
        ids(preview.map((p) => p.id)),
        `মোট ${preview.length} জন শিক্ষক একসাথে যোগ করা হয়েছে (নতুন: ${preview.length - updated}, হালনাগাদ: ${updated})`,
        notes,
      );
    },
  },

  "teachers/bulk-update": {
    describe: async ({ madrasaId, response }) => {
      const preview = list(response?.preview);
      if (!preview.length) return null;
      const updatedRows = preview.filter((p) => p.status === "updated");
      const divisionIds = updatedRows.flatMap((r) =>
        list(r.changes).filter((c) => c.field === "divisionId").flatMap((c) => [Number(c.old), Number(c.new)]),
      );
      const names = await loadAcademicNames(madrasaId, [], divisionIds);
      const value = (field: string, v: unknown) =>
        field === "divisionId" ? names.divisions.get(Number(v)) ?? showValue(v) : showValue(v);

      const lines = [
        `মোট ${preview.length} সারি — হালনাগাদ: ${response?.updated ?? updatedRows.length}, অপরিবর্তিত: ${response?.unchanged ?? 0}, বাদ পড়েছে: ${response?.skipped ?? 0}`,
      ];
      for (const row of updatedRows) {
        lines.push(`• ${row.name ?? `আইডি ${row.id}`}`);
        for (const c of list(row.changes)) {
          lines.push(`    ${TEACHER_FIELD_LABELS[c.field] ?? c.field}: ${value(c.field, c.old)} → ${value(c.field, c.new)}`);
        }
      }
      for (const row of preview.filter((p) => p.status === "skipped")) {
        lines.push(`• বাদ (সারি ${row.row}${row.name ? `, ${row.name}` : ""}): ${row.skipReason ?? row.error ?? EMPTY}`);
      }
      return lines.join("\n");
    },
  },

  /* ---------- attendance ---------- */

  "attendance/bulk": {
    describe: async ({ madrasaId, body }) => {
      const type = String(body?.attendee_type || "").toUpperCase();
      const entries = list(body?.entries).map((e) => ({
        id: Number(e?.attendee_id),
        status: String(e?.status || "").toUpperCase(),
      }));
      if (!entries.length) return null;
      const peopleIds = ids(entries.map((e) => e.id));
      const names =
        type === "TEACHER"
          ? await teacherNames(madrasaId, peopleIds)
          : type === "STAFF"
            ? await staffNames(madrasaId, peopleIds)
            : await studentNames(madrasaId, peopleIds);
      const classId = Number(body?.class_id) || 0;
      const className = classId ? (await loadAcademicNames(madrasaId, [classId], [])).classes.get(classId) : null;
      const headline = [
        `তারিখ: ${dateText(body?.date)}`,
        className ? `শ্রেণি: ${className}` : null,
        `মোট ${entries.length} জন ${ATTENDEE_OF[type] ?? ""} হাজিরা — ${countsText(entries, ATTENDANCE_LABELS)}`,
      ]
        .filter(Boolean)
        .join(", ");
      return [headline, ...byStatus(entries, names, ATTENDANCE_LABELS)].join("\n");
    },
  },

  "exam-attendance/bulk": {
    describe: async ({ madrasaId, body }) => {
      const entries = list(body?.entries).map((e) => ({
        id: Number(e?.exam_candidate_id),
        status: String(e?.status || "").toUpperCase(),
      }));
      if (!entries.length) return null;
      const [routine, candidates] = await Promise.all([
        prisma.examRoutine.findFirst({
          where: { id: Number(body?.exam_routine_id) || 0, madrasaId },
          select: { subject: true, examDate: true, classId: true, exam: { select: { name: true, year: true } } },
        }),
        prisma.examCandidate.findMany({
          where: { madrasaId, id: { in: ids(entries.map((e) => e.id)) } },
          select: { id: true, student: { select: { nameBn: true, roll: true } } },
        }),
      ]);
      const names = new Map(
        candidates.map((c) => [c.id, withExtras(c.student.nameBn, [c.student.roll != null ? `রোল: ${c.student.roll}` : null])]),
      );
      const className = routine
        ? (await loadAcademicNames(madrasaId, [routine.classId], [])).classes.get(routine.classId)
        : null;
      const headline = [
        routine?.exam ? `পরীক্ষা: ${routine.exam.name} (${routine.exam.year})` : null,
        className ? `শ্রেণি: ${className}` : null,
        routine ? `বিষয়: ${routine.subject}` : null,
        routine ? `তারিখ: ${dateText(routine.examDate)}` : null,
        `মোট ${entries.length} জন — ${countsText(entries, EXAM_ATTENDANCE_LABELS)}`,
      ]
        .filter(Boolean)
        .join(", ");
      return [headline, ...byStatus(entries, names, EXAM_ATTENDANCE_LABELS)].join("\n");
    },
  },

  /* ---------- promotion ---------- */

  "promotion/execute": {
    describe: async ({ madrasaId, body }) => {
      const entries = list(body?.decisions).map((d) => ({
        id: Number(d?.student_id),
        status: String(d?.status || "").toUpperCase(),
      }));
      if (!entries.length) return null;
      const fromClassId = Number(body?.from_class_id) || 0;
      const toClassId = Number(body?.to_class_id) || 0;
      const [classes, names] = await Promise.all([
        loadAcademicNames(madrasaId, [fromClassId, toClassId], []),
        prisma.student.findMany({
          where: { madrasaId, id: { in: ids(entries.map((e) => e.id)) } },
          select: { id: true, nameBn: true },
        }),
      ]);
      const headline =
        `${classes.classes.get(fromClassId) ?? EMPTY} (${body?.from_year ?? EMPTY}) → ` +
        `${classes.classes.get(toClassId) ?? EMPTY} (${body?.to_year ?? EMPTY}) — ` +
        `মোট ${entries.length} জন: ${countsText(entries, PROMOTION_LABELS)}`;
      return [
        headline,
        ...byStatus(entries, new Map(names.map((s) => [s.id, s.nameBn])), PROMOTION_LABELS),
      ].join("\n");
    },
  },

  /* ---------- results ---------- */

  // Marks entry grid: one row per student × subject.
  "results/marks": {
    describe: async ({ madrasaId, body }) => {
      const rows = list(body?.data);
      if (!rows.length) return null;
      const examId = Number(rows[0]?.exam_id) || 0;
      const classId = Number(rows[0]?.class_id) || 0;
      const bookIds = ids(rows.map((r) => r.book_id));
      const [exam, classes, books, names] = await Promise.all([
        prisma.exam.findFirst({ where: { id: examId, madrasaId }, select: { name: true, year: true } }),
        loadAcademicNames(madrasaId, [classId], []),
        prisma.book.findMany({ where: { id: { in: bookIds } }, select: { id: true, nameBn: true, name: true } }),
        studentNames(madrasaId, ids(rows.map((r) => r.student_id))),
      ]);
      const bookName = new Map(books.map((b) => [b.id, b.nameBn || b.name || String(b.id)]));
      const markText = (r: any) =>
        r.is_absent
          ? "অনুপস্থিত"
          : r.is_exempted
            ? "অব্যাহতি"
            : r.mark === null || r.mark === undefined || r.mark === ""
              ? "মুছে ফেলা হয়েছে"
              : String(r.mark);

      const byStudent = new Map<number, any[]>();
      for (const r of rows) {
        const id = Number(r.student_id);
        byStudent.set(id, [...(byStudent.get(id) ?? []), r]);
      }
      const single = bookIds.length === 1;
      const lines = [
        [
          exam ? `পরীক্ষা: ${exam.name} (${exam.year})` : null,
          `শ্রেণি: ${classes.classes.get(classId) ?? EMPTY}`,
          `${byStudent.size} জন শিক্ষার্থীর নম্বর সংরক্ষণ করা হয়েছে`,
        ]
          .filter(Boolean)
          .join(", "),
        `বিষয়: ${bookIds.map((id) => bookName.get(id) ?? id).join(", ")}`,
      ];
      [...byStudent.entries()].forEach(([studentId, marks], i) => {
        const who = names.get(studentId) ?? `আইডি ${studentId}`;
        const shown = single
          ? markText(marks[0])
          : marks.map((m) => `${bookName.get(Number(m.book_id)) ?? m.book_id}: ${markText(m)}`).join(", ");
        lines.push(`    ${i + 1}. ${who} — ${shown}`);
      });
      return lines.join("\n");
    },
  },

  /* ---------- fees / payroll ---------- */

  "invoices/backfill": {
    describe: async ({ madrasaId, body, response }) => {
      const data = response?.data ?? {};
      const classId = Number(body?.class_id) || 0;
      const className = classId ? (await loadAcademicNames(madrasaId, [classId], [])).classes.get(classId) : null;
      return [
        `${className ? `শ্রেণি: ${className}` : "সকল শ্রেণি"} — পুরনো ইনভয়েস তৈরি (ব্যাকফিল)`,
        `শিক্ষার্থী যাচাই: ${data.studentsProcessed ?? EMPTY} জন, নতুন ইনভয়েস: ${data.invoicesCreated ?? EMPTY} টি, ব্যর্থ: ${data.failed ?? 0}`,
      ].join("\n");
    },
  },

  "invoices/pending/clear": {
    describe: async ({ response }) =>
      `মোট ${response?.data?.cleared ?? 0} টি বকেয়া (পেন্ডিং) ইনভয়েস তালিকা থেকে ক্লিয়ার করা হয়েছে`,
  },

  "payroll/generate": {
    describe: async ({ madrasaId, body, response }) => {
      const month = String(body?.month || "");
      const data = response?.data ?? {};
      const records = await prisma.payrollRecord.findMany({
        where: { madrasaId, month },
        select: { netAmount: true, teacher: { select: { nameBn: true, designation: true } } },
        orderBy: { teacherId: "asc" },
      });
      const total = records.reduce((sum, r) => sum + Number(r.netAmount), 0);
      return [
        `মাস: ${month} — বেতন তালিকা তৈরি: নতুন ${data.created ?? 0} জন, আগে থেকেই ছিল ${data.skipped ?? 0} জন (মোট শিক্ষক ${data.totalTeachers ?? records.length} জন)`,
        `এই মাসের মোট বেতন: ${money(total)}`,
        ...records.map((r, i) => `    ${i + 1}. ${withExtras(r.teacher.nameBn, [r.teacher.designation])} — ${money(r.netAmount)}`),
      ].join("\n");
    },
  },
};

export const findBulkDescriber = (entity: string): BulkDescriber | null => BULK_DESCRIBERS[entity] ?? null;
