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
  // For an exam with a linked FeeStructure (see FeeStructure.examId): when
  // true, checkDues looks ONLY at that exam's own fee invoices, not the
  // student's whole account - so a student who has fully paid this exam's
  // fee is never blocked by an unrelated, unpaid fee elsewhere. When false
  // (default - preserves the original behavior exactly), checkDues keeps
  // checking the whole account regardless of exam-fee linkage. Has no
  // effect on an exam with no linked fee structure (checkDues always checks
  // the whole account there, since there's no specific exam fee to scope
  // to).
  SCOPE_DUES_TO_EXAM_FEE: "exam_eligibility_scope_dues_to_exam_fee",
  CHECK_ATTENDANCE: "exam_eligibility_check_attendance",
  MIN_ATTENDANCE_PERCENT: "exam_eligibility_min_attendance_percent",
} as const;

export const ELIGIBILITY_DEFAULTS = {
  requireActiveStudent: true,
  requireApprovedAdmission: true,
  checkDues: true,
  scopeDuesToExamFee: false,
  checkAttendance: false,
  minAttendancePercent: 75,
};
