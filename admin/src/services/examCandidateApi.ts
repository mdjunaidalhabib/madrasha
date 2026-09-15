import api from "./api";

/**
 * Shared Exam Master status API (the PUT /exams/:id/status and
 * activate-fee endpoints) - thin typed wrappers only, same pattern as
 * phase1Api.ts/phase2Api.ts. Pages call these directly, no React Query.
 */

/* ================= SHARED EXAM STATUS (Exam Master) ================= */

// Deliberately just two values - this is an informational label only
// (nothing gates behavior on it; the actually-enforced workflow lives on
// ResultMaster.status instead), so the old 12-step pipeline was dropped.
export type ExamStatus = "DRAFT" | "PUBLISHED";

export const EXAM_STATUS_VALUES: ExamStatus[] = ["DRAFT", "PUBLISHED"];

export const EXAM_STATUS_LABELS_BN: Record<ExamStatus, string> = {
  DRAFT: "খসড়া",
  PUBLISHED: "প্রকাশিত",
};

// Lives beside the existing Exam Master CRUD in ExamList.tsx (which still
// calls /exams directly, inline) - kept here only so the status enum/labels
// have one shared home with the candidate module below.
export const examStatusApi = {
  setStatus: (examId: number | string, status: ExamStatus) =>
    api.put(`/exams/${examId}/status`, { status }),

  // Activates a dormant exam's linked পরীক্ষার ফি structure: flips it and
  // the exam itself active, bills every currently-enrolled student it
  // covers, and notifies their guardians - see backend ExamService.
  // activateExamFee. Same "own file for exam-master extras" reasoning as
  // setStatus above.
  activateFee: (examId: number | string) =>
    api.post<{
      success: boolean;
      message: string;
      data: { feeStructuresActivated: number; invoicesCreated: number; studentsNotified: number };
    }>(`/exams/${examId}/activate-fee`),
};
