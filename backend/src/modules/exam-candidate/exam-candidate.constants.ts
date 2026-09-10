export const EXAM_CANDIDATE_STATUSES = [
  "REGISTERED",
  "ELIGIBLE",
  "INELIGIBLE",
  "WITHHELD",
  "CANCELLED",
  "COMPLETED",
] as const;

export const ELIGIBILITY_STATUSES = ["PENDING", "ELIGIBLE", "INELIGIBLE"] as const;

/** Per-madrasa eligibility rule toggles, stored as Setting rows - same
 * reuse-the-existing-Setting-model pattern as exam.constants.ts's
 * FAIL_MARK_SETTING_NAME - so the eligibility engine's rules are
 * configurable without a dedicated config table. */
export const ELIGIBILITY_SETTING_KEYS = {
  REQUIRE_ACTIVE_STUDENT: "exam_eligibility_require_active_student",
  REQUIRE_APPROVED_ADMISSION: "exam_eligibility_require_approved_admission",
  CHECK_DUES: "exam_eligibility_check_dues",
  CHECK_ATTENDANCE: "exam_eligibility_check_attendance",
  MIN_ATTENDANCE_PERCENT: "exam_eligibility_min_attendance_percent",
} as const;

export const ELIGIBILITY_DEFAULTS = {
  requireActiveStudent: true,
  requireApprovedAdmission: true,
  checkDues: true,
  checkAttendance: false,
  minAttendancePercent: 75,
};
