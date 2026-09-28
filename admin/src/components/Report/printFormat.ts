import { getPrintText } from "@madrasha/shared-ui/src/i18n";
import { normalizeBanglaDigits, toBanglaDigits } from "@madrasha/shared-ui/src/utils/reportUtils";
import { reportText } from "./report.text";

/**
 * Print-language counterparts of reportUtils' formatReportValue / cellValue /
 * formatMeritRank: backend status codes (PASS/FAIL/ABSENT...) and merit
 * ordinals (১ম/1st/الأول) follow the institution default language instead of
 * always printing Bangla. Digits already follow it via toBanglaDigits.
 */
export const printValue = (value: unknown, key = "") => {
  if (value === null || value === undefined || value === "") return "—";

  const raw = String(value).trim();
  const translated = getPrintText(reportText).status[raw.toUpperCase()];
  if (translated) return translated;

  // Email addresses must remain machine-readable.
  if (key === "email") return raw;
  return toBanglaDigits(raw);
};

export const printCell = (row: Record<string, any>, key: string) => printValue(row?.[key], key);

export const printMeritRank = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "—";

  const raw = String(value).trim();
  const numeric = Number(normalizeBanglaDigits(raw));

  if (Number.isFinite(numeric) && Number.isInteger(numeric) && numeric > 0) {
    if (numeric <= 3) return getPrintText(reportText).ordinals[numeric - 1];
    return toBanglaDigits(numeric);
  }

  return toBanglaDigits(raw);
};
