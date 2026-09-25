import { prisma } from "../database/prisma";

/**
 * Human-readable "what exactly changed" text for the activity log.
 *
 * The auto activity logger (activityLogger.middleware.ts) used to write only
 * "আইডি: 129" for most edits - meaningless to madrasa staff. For the entities
 * registered here it now snapshots the record before the request runs and
 * again after it finishes, and logs the record's name plus a
 * "field: old → new" line per changed field (or the record's summary on
 * create/delete).
 *
 * Every value is already a display string by the time it leaves a loader, so
 * the diff is a plain string compare and ids (class, division, exam) are
 * resolved to names instead of leaking raw keys into the log.
 */

export type ActivitySnapshot = {
  madrasaId: number;
  /** First line of the log detail, e.g. "পরীক্ষা: বার্ষিক পরীক্ষা (2026)". */
  title: string;
  /** Ordered label → display value. */
  fields: Record<string, string>;
  /** Labels to list on create/delete (default: every non-empty field). */
  summary?: string[];
};

type SnapshotLoader = (id: number) => Promise<ActivitySnapshot | null>;

const EMPTY = "—";

const isEmpty = (value: unknown) => value === null || value === undefined || String(value).trim() === "";

const formatDate = (value: Date) => value.toISOString().slice(0, 10);

const formatValue = (value: unknown): string => {
  if (isEmpty(value)) return EMPTY;
  if (value instanceof Date) return formatDate(value);
  if (typeof value === "boolean") return value ? "হ্যাঁ" : "না";
  return String(value).trim();
};

const formatMoney = (value: unknown) => (isEmpty(value) ? EMPTY : `৳${Number(value).toLocaleString("en-US")}`);

const onOff = (active: boolean) => (active ? "চালু" : "বন্ধ");

/* ================= STUDENT ================= */

/** Bangla labels for Student fields (Prisma camelCase names) - also used for
 * the bulk-update log, whose per-row `changes` carry these same names. */
export const STUDENT_FIELD_LABELS: Record<string, string> = {
  nameBn: "নাম (বাংলা)",
  arabicName: "নাম (আরবি)",
  nameEn: "নাম (ইংরেজি)",
  nid: "জন্ম নিবন্ধন/NID",
  gender: "লিঙ্গ",
  dob: "জন্ম তারিখ",
  age: "বয়স",
  bloodGroup: "রক্তের গ্রুপ",
  residencyType: "আবাসিক/অনাবাসিক",
  isOrphan: "এতিম",
  divisionId: "বিভাগ",
  classId: "শ্রেণি",
  academicYear: "শিক্ষাবর্ষ",
  roll: "রোল",
  registrationNo: "রেজিস্ট্রেশন নম্বর",
  previousClassId: "পূর্ববর্তী শ্রেণি",
  previousInstitution: "পূর্ববর্তী প্রতিষ্ঠান",
  previousResult: "পূর্ববর্তী ফলাফল",
  admissionDate: "ভর্তির তারিখ",
  fatherName: "পিতার নাম",
  fatherArabicName: "পিতার নাম (আরবি)",
  fatherNameEn: "পিতার নাম (ইংরেজি)",
  fatherNid: "পিতার NID",
  fatherOccupation: "পিতার পেশা",
  motherName: "মাতার নাম",
  motherArabicName: "মাতার নাম (আরবি)",
  motherNameEn: "মাতার নাম (ইংরেজি)",
  motherNid: "মাতার NID",
  motherOccupation: "মাতার পেশা",
  guardianPhone: "অভিভাবকের মোবাইল",
  guardianPhone2: "অভিভাবকের মোবাইল ২",
  altGuardianName: "বিকল্প অভিভাবকের নাম",
  altGuardianArabicName: "বিকল্প অভিভাবকের নাম (আরবি)",
  altGuardianNameEn: "বিকল্প অভিভাবকের নাম (ইংরেজি)",
  altGuardianRelation: "বিকল্প অভিভাবকের সম্পর্ক",
  altGuardianAddress: "বিকল্প অভিভাবকের ঠিকানা",
  altGuardianPhone: "বিকল্প অভিভাবকের মোবাইল",
  division: "ঠিকানা: বিভাগ",
  district: "ঠিকানা: জেলা",
  thana: "ঠিকানা: থানা",
  village: "ঠিকানা: গ্রাম",
  isActive: "অবস্থা",
};

const STUDENT_STATUS: Record<number, string> = { 1: "সক্রিয়", 0: "বহিষ্কৃত", 2: "নিষ্ক্রিয়" };

/** Formats one Student field value; class/division ids go through the given name maps. */
export const formatStudentValue = (
  field: string,
  value: unknown,
  names: { classes: Map<number, string>; divisions: Map<number, string> },
): string => {
  if (isEmpty(value)) return EMPTY;
  switch (field) {
    case "gender":
      return Number(value) === 1 ? "ছেলে" : Number(value) === 2 ? "মেয়ে" : formatValue(value);
    case "residencyType":
      return Number(value) === 1 ? "আবাসিক" : Number(value) === 2 ? "অনাবাসিক" : formatValue(value);
    case "isOrphan":
      return value === true || Number(value) === 1 ? "হ্যাঁ" : "না";
    case "isActive":
      return STUDENT_STATUS[Number(value)] ?? formatValue(value);
    case "classId":
    case "previousClassId":
      return names.classes.get(Number(value)) ?? formatValue(value);
    case "divisionId":
      return names.divisions.get(Number(value)) ?? formatValue(value);
    default:
      return formatValue(value);
  }
};

/** Resolves class/division ids to their Bangla names in two queries. */
export const loadAcademicNames = async (classIds: number[], divisionIds: number[]) => {
  const uniq = (ids: number[]) => [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  const [classes, divisions] = await Promise.all([
    uniq(classIds).length
      ? prisma.class.findMany({ where: { id: { in: uniq(classIds) } }, select: { id: true, nameBn: true, name: true } })
      : [],
    uniq(divisionIds).length
      ? prisma.division.findMany({
          where: { id: { in: uniq(divisionIds) } },
          select: { id: true, nameBn: true, name: true },
        })
      : [],
  ]);
  return {
    classes: new Map(classes.map((c) => [c.id, c.nameBn || c.name || String(c.id)])),
    divisions: new Map(divisions.map((d) => [d.id, d.nameBn || d.name || String(d.id)])),
  };
};

export const studentHeadline = (s: {
  nameBn: string;
  className?: string | null;
  roll: number | null;
  registrationNo: number | null;
}) =>
  `নাম: ${s.nameBn}, শ্রেণি: ${s.className || EMPTY}, রোল: ${s.roll ?? EMPTY}, রেজিস্ট্রেশন নম্বর: ${s.registrationNo ?? EMPTY}`;

const loadStudent: SnapshotLoader = async (id) => {
  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) return null;
  const record = student as unknown as Record<string, unknown>;
  const names = await loadAcademicNames(
    [student.classId, student.previousClassId ?? 0],
    [student.divisionId],
  );
  const fields: Record<string, string> = {};
  for (const [field, label] of Object.entries(STUDENT_FIELD_LABELS)) {
    fields[label] = formatStudentValue(field, record[field], names);
  }
  return {
    madrasaId: student.madrasaId,
    title: studentHeadline({ ...student, className: names.classes.get(student.classId) }),
    fields,
    summary: [STUDENT_FIELD_LABELS.classId, STUDENT_FIELD_LABELS.academicYear, STUDENT_FIELD_LABELS.fatherName],
  };
};

/** Detail text for an Excel bulk update: the counts, then each updated
 * student with its changed fields, then each skipped row with its reason. */
export const describeStudentBulkUpdate = async (result: {
  updated: number;
  unchanged: number;
  skipped: number;
  preview: Array<{
    row: number;
    id: number;
    name: string;
    status: string;
    changes: Array<{ field: string; old: unknown; new: unknown }>;
    error?: string;
  }>;
}) => {
  const updatedRows = result.preview.filter((r) => r.status === "updated");
  const changedFields = updatedRows.flatMap((r) => r.changes);
  const classFields = new Set(["classId", "previousClassId"]);
  const names = await loadAcademicNames(
    changedFields.filter((c) => classFields.has(c.field)).flatMap((c) => [Number(c.old), Number(c.new)]),
    changedFields.filter((c) => c.field === "divisionId").flatMap((c) => [Number(c.old), Number(c.new)]),
  );
  const students = await prisma.student.findMany({
    where: { id: { in: updatedRows.map((r) => r.id) } },
    select: { id: true, roll: true, registrationNo: true, classRef: { select: { nameBn: true, name: true } } },
  });
  const byId = new Map(students.map((s) => [s.id, s]));

  const lines = [
    `মোট ${result.preview.length} সারি — হালনাগাদ: ${result.updated}, অপরিবর্তিত: ${result.unchanged}, বাদ পড়েছে: ${result.skipped}`,
  ];
  for (const row of updatedRows) {
    const student = byId.get(row.id);
    const className = student?.classRef.nameBn || student?.classRef.name || EMPTY;
    lines.push(
      `• ${row.name} (শ্রেণি: ${className}, রোল: ${student?.roll ?? EMPTY}, রেজি: ${student?.registrationNo ?? EMPTY})`,
    );
    // Indented = belongs to the student line above (the admin UI nests it).
    for (const c of row.changes) {
      const label = STUDENT_FIELD_LABELS[c.field] ?? c.field;
      lines.push(
        `    ${label}: ${formatStudentValue(c.field, c.old, names)} → ${formatStudentValue(c.field, c.new, names)}`,
      );
    }
  }
  for (const row of result.preview.filter((r) => r.status === "skipped")) {
    lines.push(`• বাদ (সারি ${row.row}${row.name ? `, ${row.name}` : ""}): ${row.error ?? EMPTY}`);
  }
  return lines.join("\n");
};

/* ================= EXAM ================= */

const loadExam: SnapshotLoader = async (id) => {
  const exam = await prisma.exam.findUnique({
    where: { id },
    select: {
      madrasaId: true,
      name: true,
      year: true,
      examType: true,
      startDate: true,
      endDate: true,
      description: true,
      isActive: true,
      divisions: { select: { division: { select: { nameBn: true, name: true } } } },
    },
  });
  if (!exam) return null;
  const divisionNames = exam.divisions.map((d) => d.division.nameBn || d.division.name).filter(Boolean);
  return {
    madrasaId: exam.madrasaId,
    title: `পরীক্ষা: ${exam.name} (${exam.year})`,
    fields: {
      "পরীক্ষার নাম": formatValue(exam.name),
      বছর: formatValue(exam.year),
      "পরীক্ষার ধরন": formatValue(exam.examType),
      "শুরুর তারিখ": formatValue(exam.startDate),
      "শেষ তারিখ": formatValue(exam.endDate),
      বিভাগ: divisionNames.length ? divisionNames.join(", ") : "সকল বিভাগ",
      বিবরণ: formatValue(exam.description),
      অবস্থা: onOff(exam.isActive),
    },
    summary: ["বছর", "পরীক্ষার ধরন", "বিভাগ", "অবস্থা"],
  };
};

/** পরীক্ষার ফি (ফি সেটাপ exam × class table) - id is the EXAM id. */
const loadExamFee: SnapshotLoader = async (examId) => {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { madrasaId: true, name: true, year: true, isActive: true },
  });
  if (!exam) return null;
  const rows = await prisma.feeStructure.findMany({
    where: { madrasaId: exam.madrasaId, examId },
    orderBy: [{ classId: "asc" }, { id: "asc" }],
    select: { amount: true, isActive: true, class: { select: { nameBn: true, name: true } } },
  });
  const fields: Record<string, string> = {
    "ফি অবস্থা": onOff(exam.isActive && rows.some((r) => r.isActive)),
  };
  for (const row of rows) {
    const className = row.class ? row.class.nameBn || row.class.name : "সব শ্রেণি";
    fields[`${className} শ্রেণির ফি`] = formatMoney(row.amount);
  }
  return { madrasaId: exam.madrasaId, title: `পরীক্ষা: ${exam.name} (${exam.year})`, fields };
};

/* ================= FEE ================= */

const FREQUENCY_LABELS: Record<string, string> = { ONE_TIME: "এককালীন", MONTHLY: "মাসিক", YEARLY: "বাৎসরিক" };

const loadFeeStructure: SnapshotLoader = async (id) => {
  const fee = await prisma.feeStructure.findUnique({
    where: { id },
    select: {
      madrasaId: true,
      name: true,
      feeType: true,
      amount: true,
      frequency: true,
      academicYear: true,
      isActive: true,
      class: { select: { nameBn: true, name: true } },
      exam: { select: { name: true } },
    },
  });
  if (!fee) return null;
  return {
    madrasaId: fee.madrasaId,
    title: `ফি: ${fee.name}`,
    fields: {
      "ফি-এর নাম": formatValue(fee.name),
      "ফি ধরণ": formatValue(fee.feeType),
      শ্রেণি: fee.class ? formatValue(fee.class.nameBn || fee.class.name) : "সকল শ্রেণি",
      পরিমাণ: formatMoney(fee.amount),
      "আদায়ের ধরন": FREQUENCY_LABELS[fee.frequency] ?? fee.frequency,
      শিক্ষাবর্ষ: formatValue(fee.academicYear),
      পরীক্ষা: formatValue(fee.exam?.name),
      অবস্থা: onOff(fee.isActive),
    },
    summary: ["ফি ধরণ", "শ্রেণি", "পরিমাণ", "আদায়ের ধরন", "শিক্ষাবর্ষ"],
  };
};

const loadFeeCategory: SnapshotLoader = async (id) => {
  const category = await prisma.feeCategory.findUnique({
    where: { id },
    select: { madrasaId: true, name: true, isAdmissionType: true, sortOrder: true, isActive: true },
  });
  if (!category) return null;
  return {
    madrasaId: category.madrasaId,
    title: `ফি ধরণ: ${category.name}`,
    fields: {
      নাম: formatValue(category.name),
      "ভর্তির সময় আদায়যোগ্য": category.isAdmissionType ? "হ্যাঁ" : "না",
      ক্রম: formatValue(category.sortOrder),
      অবস্থা: onOff(category.isActive),
    },
    summary: ["ভর্তির সময় আদায়যোগ্য", "অবস্থা"],
  };
};

/* ================= REGISTRY ================= */

const LOADERS_BY_ENTITY: Record<string, SnapshotLoader> = {
  exams: loadExam,
  "fee-structures": loadFeeStructure,
  "fee-structures/exam-fees": loadExamFee,
  "fee-structures/exam-fees/status": loadExamFee,
  "fee-categories": loadFeeCategory,
};

/** The snapshot loader for an auto-logged entity path, if it has one. Every
 * students sub-route (update, expel, inactive, photo, ...) shares the student
 * loader so the log names the student and shows what changed. */
export const findSnapshotLoader = (entity: string): SnapshotLoader | null => {
  if (LOADERS_BY_ENTITY[entity]) return LOADERS_BY_ENTITY[entity];
  if (entity === "students" || entity.startsWith("students/")) return loadStudent;
  return null;
};

const listSummary = (snapshot: ActivitySnapshot) => {
  const labels = snapshot.summary ?? Object.keys(snapshot.fields);
  return labels
    .filter((label) => snapshot.fields[label] !== undefined && snapshot.fields[label] !== EMPTY)
    .map((label) => `${label}: ${snapshot.fields[label]}`);
};

/**
 * Builds the multi-line detail text from the before/after snapshots:
 * - both → title + one "label: old → new" line per changed field
 * - before only (deleted) → title + the record's summary
 * - after only (created) → title + the record's summary
 */
export const buildSnapshotDetails = (
  before: ActivitySnapshot | null,
  after: ActivitySnapshot | null,
): string | null => {
  if (before && after) {
    const labels = [
      ...Object.keys(after.fields),
      ...Object.keys(before.fields).filter((label) => !(label in after.fields)),
    ];
    const changes = labels
      .map((label) => ({ label, old: before.fields[label] ?? EMPTY, next: after.fields[label] ?? EMPTY }))
      .filter((c) => c.old !== c.next)
      .map((c) => `${c.label}: ${c.old} → ${c.next}`);
    return [after.title, ...(changes.length ? changes : ["কোনো তথ্য পরিবর্তন হয়নি"])].join("\n");
  }
  const only = before ?? after;
  if (!only) return null;
  return [only.title, ...listSummary(only)].join("\n");
};
