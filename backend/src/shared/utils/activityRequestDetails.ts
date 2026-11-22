/** Explicit allow-list: passwords, credentials, tokens and file contents are never read. */
const FIELDS: Record<string, string> = {
  student_id: "শিক্ষার্থীর আইডি",
  teacher_id: "শিক্ষকের আইডি",
  staff_id: "স্টাফ আইডি",
  attendee_id: "হাজিরাদাতার আইডি",
  user_id: "ইউজার আইডি",
  role_id: "রোল আইডি",
  exam_id: "পরীক্ষার আইডি",
  class_id: "শ্রেণির আইডি",
  division_id: "বিভাগের আইডি",
  book_id: "বইয়ের আইডি",
  room_id: "কক্ষের আইডি",
  device_id: "ডিভাইস আইডি",
  device_user_id: "ডিভাইসের ইউজার আইডি",
  session_id: "সেশনের আইডি",
  fund_id: "ফান্ড আইডি",
  category_id: "খাতের আইডি",
  name_bn: "নাম",
  nameBn: "নাম",
  name: "নাম",
  title: "শিরোনাম",
  name_en: "নাম (ইংরেজি)",
  name_ar: "নাম (আরবি)",
  designation: "পদবি",
  department: "দপ্তর",
  code: "কোড",
  device_code: "ডিভাইস কোড",
  date: "তারিখ",
  from_date: "শুরুর তারিখ",
  to_date: "শেষ তারিখ",
  start_date: "শুরুর তারিখ",
  end_date: "শেষ তারিখ",
  month: "মাস",
  year: "বছর",
  academic_year: "শিক্ষাবর্ষ",
  start_time: "শুরুর সময়",
  end_time: "শেষ সময়",
  amount: "পরিমাণ",
  salary: "বেতন",
  allowances: "ভাতা",
  deductions: "কর্তন",
  status: "অবস্থা",
  is_active: "সক্রিয়",
  isActive: "সক্রিয়",
  type: "ধরন",
  attendee_type: "হাজিরার ধরন",
  leave_type: "ছুটির ধরন",
  reason: "কারণ",
  review_note: "পর্যালোচনার মন্তব্য",
  capacity: "আসন সংখ্যা",
  floor: "তলা",
  location: "অবস্থান",
  author: "লেখক",
  isbn: "ISBN",
  publisher: "প্রকাশক",
  copies_total: "মোট কপি",
  due_date: "ফেরতের তারিখ",
  payment_method: "পরিশোধের মাধ্যম",
  residential_only: "শুধু আবাসিক",
  sort_order: "ক্রম",
  subject: "বিষয়",
};
const LISTS: Record<string, string> = {
  ids: "নির্বাচিত রেকর্ড",
  student_ids: "নির্বাচিত শিক্ষার্থী",
  teacher_ids: "নির্বাচিত শিক্ষক",
  students: "শিক্ষার্থী",
  teachers: "শিক্ষক",
  staff: "স্টাফ",
  items: "এন্ট্রি",
  records: "রেকর্ড",
  entries: "এন্ট্রি",
  permissions: "পারমিশন",
  permission_ids: "পারমিশন",
  assignments: "বণ্টন",
  marks: "নম্বর",
  rows: "সারি",
};
const COUNTS: Record<string, string> = {
  created: "তৈরি হয়েছে",
  updated: "হালনাগাদ হয়েছে",
  deleted: "মুছে ফেলা হয়েছে",
  affectedRows: "প্রভাবিত রেকর্ড",
  count: "মোট রেকর্ড",
  successCount: "সফল",
  failedCount: "ব্যর্থ",
  skipped: "বাদ পড়েছে",
  total: "মোট",
  inserted: "যুক্ত হয়েছে",
};
const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const scalar = (value: unknown): string | null => {
  if (typeof value === "boolean") return value ? "হ্যাঁ" : "না";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (typeof value !== "string") return null;
  const clean = value.replace(/[\r\n\t\u0000-\u001f\u007f]/g, " ").trim();
  if (!clean || /^(data:|Bearer\s)/i.test(clean)) return null;
  return clean.length > 200 ? `${clean.slice(0, 200)}…` : clean;
};

/** Only the direct returned resource id; never a nested related-record id. */
export function responseEntityId(payload: unknown): number | null {
  const root = record(payload);
  for (const value of [root?.id, record(root?.data)?.id]) {
    const id =
      typeof value === "number"
        ? value
        : typeof value === "string" && /^\d+$/.test(value)
          ? Number(value)
          : NaN;
    if (Number.isSafeInteger(id) && id > 0) return id;
  }
  return null;
}

export function describeActivityRequest(
  body: unknown,
  response: unknown,
  id: number | null,
): string {
  const input = record(body);
  const lines: string[] = [];
  if (id !== null) lines.push(`রেকর্ড আইডি: ${id}`);
  if (input) {
    for (const [key, label] of Object.entries(FIELDS)) {
      const value = scalar(input[key]);
      if (value !== null) lines.push(`${label}: ${value}`);
    }
    for (const [key, label] of Object.entries(LISTS)) {
      if (Array.isArray(input[key])) lines.push(`${label}: ${(input[key] as unknown[]).length} টি`);
    }
  }
  const root = record(response);
  const result = record(root?.data) ?? root;
  for (const [key, label] of Object.entries(COUNTS)) {
    const value = result?.[key];
    if (typeof value === "number" && Number.isFinite(value)) lines.push(`${label}: ${value}`);
  }
  return lines.join("\n") || "অনুরোধটি সফলভাবে সম্পন্ন হয়েছে";
}
