export const REPORT_LOAD_FAILED_MESSAGE = "রিপোর্ট লোড করা যায়নি";
export const REPORT_MISSING_TABLE_WARNING =
  "এই রিপোর্টের জন্য প্রয়োজনীয় database table/column এখনো পাওয়া যায়নি।";
export const REPORT_TENANT_NOT_FOUND_MESSAGE = "Tenant madrasa not found";

// Prisma wraps the raw MySQL driver error; the original mysql2 error code
// (ER_NO_SUCH_TABLE / ER_BAD_FIELD_ERROR) shows up either directly or in
// `meta` depending on Prisma version.
export const MISSING_TABLE_OR_COLUMN_CODES = ["ER_NO_SUCH_TABLE", "ER_BAD_FIELD_ERROR"];
