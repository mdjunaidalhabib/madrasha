export const DEFAULT_FAIL_MARK = 35;
export const FAIL_MARK_SETTING_NAME = "fail_mark";
export const DEFAULT_GENERAL_GRADE_FALLBACK = "F";
export const DEFAULT_MADRASA_GRADE_FALLBACK = "রাসিব";

// DRAFT and PUBLISHED are the two original values (kept for compat with any
// direct string comparisons already in the codebase). The rest are the
// additive marks/verification/approval workflow states - see
// ResultPublishStatus in prisma/models/result.prisma for the authoritative
// definition and the allowed forward progression.
export const RESULT_STATUS = {
  DRAFT: "DRAFT",
  MARKS_SUBMITTED: "MARKS_SUBMITTED",
  MARKS_VERIFIED: "MARKS_VERIFIED",
  PROCESSING: "PROCESSING",
  RESULT_VERIFIED: "RESULT_VERIFIED",
  APPROVED: "APPROVED",
  PUBLISHED: "PUBLISHED",
  LOCKED: "LOCKED",
} as const;

export const MARK_STATUS = {
  PASS: "PASS",
  FAIL: "FAIL",
  ABSENT: "ABSENT",
} as const;

export const MARK_ENTRY_STATUS = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
} as const;

export const CORRECTION_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  APPLIED: "APPLIED",
} as const;
