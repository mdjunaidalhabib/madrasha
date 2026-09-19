/**
 * The fail grade is NOT a grade band. A student whose marks are <= the fail
 * mark automatically gets it ("রাসিব" in a madrasa scale, "F" in a general
 * scale). It is shown as the automatic red row in the settings UI and must
 * never be listed, counted or chained as a real band - even if a legacy row
 * with that name still exists in the database.
 */
export type GradeKind = "madrasa" | "general";

export const MADRASA_FAIL_GRADE = "রাসিব";
export const GENERAL_FAIL_GRADE = "F";

export const failGradeName = (kind: GradeKind) => (kind === "madrasa" ? MADRASA_FAIL_GRADE : GENERAL_FAIL_GRADE);

/** True when `name` is the reserved fail-grade name for that kind of scale.
 * Trimmed; the Latin "F" also matches case-insensitively ("f"). */
export const isFailGrade = (kind: GradeKind, name: unknown): boolean => {
  const n = String(name ?? "").trim();
  return kind === "madrasa" ? n === MADRASA_FAIL_GRADE : n.toUpperCase() === GENERAL_FAIL_GRADE;
};

/** The real grade bands of a scale: everything except a (legacy) fail-named row. */
export const withoutFailGrades = <T extends { name: string }>(kind: GradeKind, grades: T[]): T[] =>
  grades.filter((g) => !isFailGrade(kind, g.name));
