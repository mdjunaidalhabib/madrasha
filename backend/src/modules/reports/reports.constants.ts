export const REPORT_LOAD_FAILED_MESSAGE = "রিপোর্ট লোড করা যায়নি";
export const REPORT_MISSING_TABLE_WARNING =
  "এই রিপোর্টের জন্য প্রয়োজনীয় database table/column এখনো পাওয়া যায়নি।";
export const REPORT_TENANT_NOT_FOUND_MESSAGE = "Tenant madrasa not found";

// Prisma wraps the raw Postgres driver error; the SQLSTATE code
// (42P01 = undefined_table, 42703 = undefined_column) shows up either
// directly or in `meta` depending on Prisma version.
export const MISSING_TABLE_OR_COLUMN_CODES = ["42P01", "42703"];
