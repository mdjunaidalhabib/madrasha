const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

// Sentinel stored in a marks-entry cell's local state to mean "student is
// absent for this subject" — typed as a plain `number` (not a separate
// union member) so it flows through the existing
// `Record<studentId, Record<bookId, number | null>>` state/save-payload
// shapes untouched. Negative and outside 0..full_marks, so it can never
// collide with a real score.
export const ABSENT_MARK = -1;
export const ABSENT_MARK_LABEL = "অনু";

const REPORT_TEXT_MAP: Record<string, string> = {
  PASS: "PASS",
  FAIL: "FAIL",
  PRESENT: "উপস্থিত",
  ABSENT: "অনুপস্থিত",
  DRAFT: "খসড়া",
  PUBLISHED: "প্রকাশিত",
  INCOMPLETE: "অসম্পূর্ণ",
};

export const toBanglaDigits = (value: string | number) =>
  String(value).replace(/\d/g, (digit) => BANGLA_DIGITS[Number(digit)]);

export const normalizeBanglaDigits = (value: string) =>
  value.replace(/[০-৯]/g, (digit) => String(BANGLA_DIGITS.indexOf(digit)));

export const formatReportValue = (value: unknown, key = "") => {
  if (value === null || value === undefined || value === "") return "—";

  const raw = String(value).trim();
  const translated = REPORT_TEXT_MAP[raw.toUpperCase()] || raw;

  // Email addresses must remain machine-readable; all other document values
  // use Bengali digits for a consistent Bangla print output.
  if (key === "email") return translated;
  return toBanglaDigits(translated);
};

export const formatMeritRank = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "—";

  const raw = String(value).trim();
  const normalized = normalizeBanglaDigits(raw);
  const numeric = Number(normalized);

  if (Number.isFinite(numeric) && Number.isInteger(numeric) && numeric > 0) {
    if (numeric === 1) return "১ম";
    if (numeric === 2) return "২য়";
    if (numeric === 3) return "৩য়";
    return toBanglaDigits(numeric);
  }

  return toBanglaDigits(raw);
};

export const cellValue = (row: Record<string, any>, key: string) =>
  formatReportValue(row?.[key], key);

export const getRowDivisionId = (row: Record<string, any>) =>
  row.division_id ||
  row.madrasa_division_id ||
  row.divisionId ||
  row.division?.division_id ||
  row.division?.id ||
  "";

export const getRowClassId = (row: Record<string, any>) =>
  row.class_id || row.madrasa_class_id || row.classId || row.class?.class_id || row.class?.id || "";
