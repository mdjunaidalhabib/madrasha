export const FAIL_MARK_SETTING_NAME = "fail_mark";
export const DEFAULT_FAIL_MARK = "35";
export const MIN_MARK = 0;
export const MAX_MARK = 100;

// Mirrors the Prisma ExamStatus enum (exam.prisma) - kept as a plain string
// array here too so the service layer can validate an incoming status
// value without importing the Prisma enum type into the DTO layer.
// Deliberately just two values - this field is an informational label only
// (nothing in the backend gates behavior on it; the real, enforced workflow
// state machine lives on ResultMaster.status instead), so the finer-grained
// 12-step pipeline was dropped as unused complexity.
export const EXAM_STATUSES = ["DRAFT", "PUBLISHED"] as const;
