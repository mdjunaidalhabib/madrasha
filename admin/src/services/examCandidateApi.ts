import api from "./api";

/**
 * Exam Candidate Registration & Eligibility API bindings (backend module
 * mounted at /exam-candidates, plus the PUT /exams/:id/status endpoint that
 * lives alongside the existing Exam Master CRUD) - thin typed wrappers only,
 * same pattern as phase1Api.ts/phase2Api.ts. Pages call these directly, no
 * React Query.
 */

/* ================= SHARED EXAM STATUS (Exam Master) ================= */

export type ExamStatus =
  | "DRAFT"
  | "PLANNED"
  | "REGISTRATION_OPEN"
  | "REGISTRATION_CLOSED"
  | "SCHEDULED"
  | "ONGOING"
  | "MARKS_ENTRY"
  | "VERIFICATION"
  | "RESULT_PROCESSING"
  | "RESULT_APPROVAL"
  | "PUBLISHED"
  | "LOCKED"
  | "CANCELLED";

// Exact lifecycle order, as documented by the backend.
export const EXAM_STATUS_VALUES: ExamStatus[] = [
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
];

export const EXAM_STATUS_LABELS_BN: Record<ExamStatus, string> = {
  DRAFT: "খসড়া",
  PLANNED: "পরিকল্পিত",
  REGISTRATION_OPEN: "নিবন্ধন চলছে",
  REGISTRATION_CLOSED: "নিবন্ধন বন্ধ",
  SCHEDULED: "সময়সূচি নির্ধারিত",
  ONGOING: "চলমান",
  MARKS_ENTRY: "নম্বর ইনপুট চলছে",
  VERIFICATION: "যাচাই চলছে",
  RESULT_PROCESSING: "ফলাফল প্রক্রিয়াকরণ",
  RESULT_APPROVAL: "ফলাফল অনুমোদন",
  PUBLISHED: "ফলাফল প্রকাশিত",
  LOCKED: "লকড",
  CANCELLED: "বাতিল",
};

// Lives beside the existing Exam Master CRUD in ExamList.tsx (which still
// calls /exams directly, inline) - kept here only so the status enum/labels
// have one shared home with the candidate module below.
export const examStatusApi = {
  setStatus: (examId: number | string, status: ExamStatus) =>
    api.put(`/exams/${examId}/status`, { status }),
};

/* ================= EXAM CANDIDATE STATUS ================= */

export type ExamCandidateStatus =
  | "REGISTERED"
  | "ELIGIBLE"
  | "INELIGIBLE"
  | "WITHHELD"
  | "CANCELLED"
  | "COMPLETED";

export const EXAM_CANDIDATE_STATUS_VALUES: ExamCandidateStatus[] = [
  "REGISTERED",
  "ELIGIBLE",
  "INELIGIBLE",
  "WITHHELD",
  "CANCELLED",
  "COMPLETED",
];

export const EXAM_CANDIDATE_STATUS_LABELS_BN: Record<ExamCandidateStatus, string> = {
  REGISTERED: "নিবন্ধিত",
  ELIGIBLE: "যোগ্য",
  INELIGIBLE: "অযোগ্য",
  WITHHELD: "স্থগিত",
  CANCELLED: "বাতিল",
  COMPLETED: "সম্পন্ন",
};

export type EligibilityStatus = "PENDING" | "ELIGIBLE" | "INELIGIBLE";

export const ELIGIBILITY_STATUS_LABELS_BN: Record<EligibilityStatus, string> = {
  PENDING: "পেন্ডিং",
  ELIGIBLE: "যোগ্য",
  INELIGIBLE: "অযোগ্য",
};

/* ================= EXAM CANDIDATE ROW ================= */

export interface ExamCandidateRow {
  id: number;
  madrasaId: number;
  examId: number;
  studentId: number;
  sessionId: number;
  classId: number;
  divisionId: number;
  registrationNo: string | null;
  candidateNo: string | null;
  status: ExamCandidateStatus;
  eligibilityStatus: EligibilityStatus;
  /** JSON-stringified array of Bangla reason strings - JSON.parse before
   * display, guard against null (see parseEligibilityReasons in
   * ExamCandidateRegistrationPage.tsx). */
  eligibilityReasons: string | null;
  eligibilityCheckedAt: string | null;
  registrationDate: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  student: {
    id: number;
    nameBn: string;
    nameEn: string | null;
    roll: number | string | null;
    registrationNo: string | number | null;
    guardianPhone: string | null;
    isActive: boolean | number;
    admissionStatus: string | null;
  };
  class: { id: number; name: string; nameBn: string };
  division: { id: number; name: string; nameBn: string };
}

export interface ExamCandidatePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface EligibleStudentPreview {
  student_id: number;
  name_bn: string;
  name_en?: string | null;
  roll: number | string | null;
  class_id: number;
  division_id: number;
  eligible: boolean;
  reasons: string[];
}

export interface EligibilitySettings {
  requireActiveStudent: boolean;
  requireApprovedAdmission: boolean;
  checkDues: boolean;
  scopeDuesToExamFee: boolean;
  checkAttendance: boolean;
  minAttendancePercent: number;
}

export interface ExamCandidateListParams {
  exam_id: number;
  class_id?: number;
  division_id?: number;
  status?: ExamCandidateStatus;
  eligibility_status?: EligibilityStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export interface EligibleStudentsParams {
  exam_id: number;
  class_id?: number;
  division_id?: number;
  search?: string;
}

export const examCandidateApi = {
  list: (params: ExamCandidateListParams) =>
    api.get<{ success: boolean; data: ExamCandidateRow[]; pagination: ExamCandidatePagination }>(
      "/exam-candidates",
      { params },
    ),

  get: (id: number | string) =>
    api.get<{ success: boolean; data: ExamCandidateRow }>(`/exam-candidates/${id}`),

  eligibleStudents: (params: EligibleStudentsParams) =>
    api.get<{ success: boolean; data: EligibleStudentPreview[] }>(
      "/exam-candidates/eligible-students",
      { params },
    ),

  eligibilityCheck: (payload: { candidate_id: number } | { exam_id: number; student_id: number }) =>
    api.post<{
      success: boolean;
      data: { candidate_id: number | null; eligible: boolean; reasons: string[] };
    }>("/exam-candidates/eligibility-check", payload),

  bulkEligibilityCheck: (payload: { exam_id: number; candidate_ids?: number[] }) =>
    api.post<{ success: boolean; data: { checked: number; eligible: number; ineligible: number } }>(
      "/exam-candidates/bulk-eligibility-check",
      payload,
    ),

  getEligibilitySettings: () =>
    api.get<{ success: boolean; data: EligibilitySettings }>("/exam-candidates/eligibility-settings"),

  updateEligibilitySettings: (payload: {
    require_active_student?: boolean;
    require_approved_admission?: boolean;
    check_dues?: boolean;
    scope_dues_to_exam_fee?: boolean;
    check_attendance?: boolean;
    min_attendance_percent?: number;
  }) =>
    api.put<{ success: boolean; data: EligibilitySettings }>(
      "/exam-candidates/eligibility-settings",
      payload,
    ),

  setStatus: (id: number | string, payload: { status: ExamCandidateStatus; notes?: string }) =>
    api.put<{ success: boolean; message: string }>(`/exam-candidates/${id}/status`, payload),

  bulkSetStatus: (payload: { ids: number[]; status: ExamCandidateStatus; notes?: string }) =>
    api.post<{ success: boolean; data: { updated: number } }>(
      "/exam-candidates/bulk-status",
      payload,
    ),

  // Soft "cancel" - sets status to CANCELLED, not a hard delete.
  cancel: (id: number | string) => api.delete<{ success: boolean; message: string }>(`/exam-candidates/${id}`),
};
