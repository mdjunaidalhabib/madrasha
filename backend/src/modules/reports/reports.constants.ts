import { t } from "../../shared/i18n";
export const REPORT_LOAD_FAILED_MESSAGE = (): string =>
  t({ bn: "রিপোর্ট লোড করা যায়নি", en: "Failed to load the report" });
export const REPORT_MISSING_TABLE_WARNING =
  (): string =>
  t({ bn: "এই রিপোর্টের জন্য প্রয়োজনীয় database table/column এখনো পাওয়া যায়নি।", en: "The database table/column this report needs was not found yet." });
export const REPORT_TENANT_NOT_FOUND_MESSAGE = (): string =>
  t({ bn: "প্রতিষ্ঠান পাওয়া যায়নি", en: "Institution not found" });

// Prisma wraps the raw Postgres driver error; the SQLSTATE code
// (42P01 = undefined_table, 42703 = undefined_column) shows up either
// directly or in `meta` depending on Prisma version.
export const MISSING_TABLE_OR_COLUMN_CODES = ["42P01", "42703"];
