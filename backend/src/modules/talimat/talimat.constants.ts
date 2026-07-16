/** Grade cutoffs (by average marks), extracted unchanged from talimat.controller.ts */
export const TALIMAT_GRADE_THRESHOLDS: Array<{ min: number; grade: string }> = [
  { min: 80, grade: "A+" },
  { min: 70, grade: "A" },
  { min: 60, grade: "A-" },
  { min: 50, grade: "B" },
  { min: 40, grade: "C" },
];
export const TALIMAT_FAIL_GRADE = "F";
