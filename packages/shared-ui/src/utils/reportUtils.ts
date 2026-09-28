import { getPrintLang } from "../i18n/languageStore";
import { localizeDigits } from "../i18n/format";
import { getPrintText, getText } from "../i18n/text";
import { reportUtilsText } from "./reportUtils.text";

// Sentinel stored in a marks-entry cell's local state to mean "student is
// absent for this subject" — typed as a plain `number` (not a separate
// union member) so it flows through the existing
// `Record<studentId, Record<bookId, number | null>>` state/save-payload
// shapes untouched. Negative and outside 0..full_marks, so it can never
// collide with a real score.
export const ABSENT_MARK = -1;
/** @deprecated Bangla-only constant kept for existing callers - use
 * getAbsentMarkLabel() (UI language) or getAbsentMarkLabel(true) (print). */
export const ABSENT_MARK_LABEL = reportUtilsText.bn.absentMark;

/** Short "absent" label for a marks cell - in the current UI language, or in
 * the print (institution default) language when `forPrint` is true. */
export const getAbsentMarkLabel = (forPrint = false) =>
  (forPrint ? getPrintText(reportUtilsText) : getText(reportUtilsText)).absentMark;

/** Status code -> printed label, in the print language. */
const reportTextFor = (code: string): string | undefined => getPrintText(reportUtilsText).statuses[code];

/** Digits in the PRINT language (the institution default - bn: ০১২, en: 012).
 * Historically Bangla-only, hence the name; every report/document
 * call site now follows the institution language automatically. For on-screen
 * (non-print) UI use localizeDigits(value, lang) with the user UI language. */
export const toBanglaDigits = (value: string | number) => localizeDigits(value, getPrintLang());

/** Any Bangla/Arabic numerals -> ASCII. */
export const normalizeBanglaDigits = (value: string) => localizeDigits(value, "en");

export const formatReportValue = (value: unknown, key = "") => {
  if (value === null || value === undefined || value === "") return "—";

  const raw = String(value).trim();
  const translated = reportTextFor(raw.toUpperCase()) || raw;

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
    const t = getPrintText(reportUtilsText);
    if (numeric === 1) return t.rank1;
    if (numeric === 2) return t.rank2;
    if (numeric === 3) return t.rank3;
    return toBanglaDigits(numeric);
  }

  return toBanglaDigits(raw);
};

export const cellValue = (row: Record<string, any>, key: string) =>
  formatReportValue(
    // School/college results carry a board GPA - show it beside the letter grade.
    key === "general_grade" && row?.general_grade && typeof row?.gpa === "number"
      ? `${row.general_grade} (${row.gpa.toFixed(2)})`
      : row?.[key],
    key,
  );

export const getRowDivisionId = (row: Record<string, any>) =>
  row.division_id ||
  row.madrasa_division_id ||
  row.divisionId ||
  row.division?.division_id ||
  row.division?.id ||
  "";

export const getRowClassId = (row: Record<string, any>) =>
  row.class_id || row.madrasa_class_id || row.classId || row.class?.class_id || row.class?.id || "";
