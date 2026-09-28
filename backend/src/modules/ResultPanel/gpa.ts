/**
 * Bangladesh board-style GPA (SSC/HSC rules) for school/college tenants.
 * Madrasas keep the percentage-average grading in result-panel.service.ts.
 *
 * - Each subject's percentage maps to a grade point via the general grade
 *   scale (GeneralGrade.point).
 * - Failing ANY compulsory subject (absent, or below its pass mark) fails
 *   the whole result: GPA 0.
 * - The optional (4th) subject never fails the student; only its grade
 *   point above 2 is added on top.
 * - GPA = total points / number of compulsory subjects, capped at 5.
 */

export type GpaSubjectMark = {
  mark: number;
  fullMark: number;
  /** Absolute pass mark for this subject (null = the class fail mark). */
  passMark: number | null;
  isOptional: boolean;
  isAbsent: boolean;
  isExempted: boolean;
};

export type PointBand = { name: string; minMark: number; maxMark: number; point: number | null };

export const MAX_GPA = 5;
const OPTIONAL_SUBJECT_BASE_POINT = 2;

/** Grade point for a percentage; 0 when it falls below every band. */
export function gradePointFor(percent: number, bands: PointBand[]): number {
  const band = bands.find((b) => percent >= b.minMark && percent <= b.maxMark);
  return band?.point ?? 0;
}

export function computeGpa(
  subjects: GpaSubjectMark[],
  bands: PointBand[],
  failMark: number,
): { gpa: number; failed: boolean } {
  const counted = subjects.filter((s) => !s.isExempted);
  const compulsory = counted.filter((s) => !s.isOptional);
  if (!compulsory.length) return { gpa: 0, failed: true };

  const pointOf = (s: GpaSubjectMark) => {
    if (s.isAbsent || s.mark < (s.passMark ?? failMark)) return null; // failed subject
    const percent = s.fullMark > 0 ? (s.mark / s.fullMark) * 100 : 0;
    return gradePointFor(percent, bands);
  };

  let total = 0;
  for (const s of compulsory) {
    const point = pointOf(s);
    if (point === null) return { gpa: 0, failed: true };
    total += point;
  }
  for (const s of counted.filter((x) => x.isOptional)) {
    const point = pointOf(s);
    if (point !== null) total += Math.max(0, point - OPTIONAL_SUBJECT_BASE_POINT);
  }

  const gpa = Math.min(MAX_GPA, total / compulsory.length);
  return { gpa: Math.round(gpa * 100) / 100, failed: false };
}

/** Letter grade for a GPA: the band with the highest point the GPA reaches
 * (A+ at 5.00, A at 4.00-4.99, ...). Null when no band qualifies. */
export function gradeForGpa(gpa: number, bands: PointBand[]): string | null {
  const byPoint = bands
    .filter((b): b is PointBand & { point: number } => b.point !== null)
    .sort((a, b) => b.point - a.point);
  return byPoint.find((b) => gpa >= b.point)?.name ?? null;
}
