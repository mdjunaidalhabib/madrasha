export const FAIL_MARK_SETTING_NAME = "fail_mark";
export const DEFAULT_FAIL_MARK = "35";
export const MIN_MARK = 0;
export const MAX_MARK = 100;

// Mirrors the Prisma ExamStatus enum (exam.prisma) - kept as a plain string
// array here too so the service layer can validate an incoming status
// value without importing the Prisma enum type into the DTO layer.
export const EXAM_STATUSES = [
  "DRAFT",
  "PLANNED",
  "REGISTRATION_OPEN",
  "REGISTRATION_CLOSED",
  "SCHEDULED",
  "ONGOING",
  "MARKS_ENTRY",
  "VERIFICATION",
  "RESULT_PROCESSING",
  "RESULT_APPROVAL",
  "PUBLISHED",
  "LOCKED",
  "CANCELLED",
] as const;
