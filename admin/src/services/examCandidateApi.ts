import api from "./api";

/**
 * Exam Master extras (the activate-fee endpoint) - thin typed wrappers only,
 * same pattern as phase1Api.ts/phase2Api.ts. Pages call these directly, no
 * React Query.
 *
 * The old খসড়া/প্রকাশিত exam status was removed: nothing ever gated on it,
 * and it read like result publishing, which lives on ResultMaster.status.
 * An exam's only lifecycle switch is now সক্রিয়/নিষ্ক্রিয় (Exam.isActive).
 */
export const examStatusApi = {
  // Activates a dormant exam's linked পরীক্ষার ফি structure: flips it and
  // the exam itself active, bills every currently-enrolled student it
  // covers, and notifies their guardians - see backend ExamService.
  // activateExamFee.
  activateFee: (examId: number | string) =>
    api.post<{
      success: boolean;
      message: string;
      data: { feeStructuresActivated: number; invoicesCreated: number; studentsNotified: number };
    }>(`/exams/${examId}/activate-fee`),
};
