export const DEFAULT_FAIL_MARK = 35;
export const FAIL_MARK_SETTING_NAME = "fail_mark";
export const DEFAULT_GENERAL_GRADE_FALLBACK = "F";
export const DEFAULT_MADRASA_GRADE_FALLBACK = "রাসিব";

// The three resting states of a result session: DRAFT (marks being entered),
// PROCESSING (graded + ranked, waiting to be published) and PUBLISHED. See
// ResultPublishStatus in prisma/models/result.prisma for the definition.
export const RESULT_STATUS = {
  DRAFT: "DRAFT",
  PROCESSING: "PROCESSING",
  PUBLISHED: "PUBLISHED",
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
