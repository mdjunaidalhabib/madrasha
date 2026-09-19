/**
 * Division-scoped grading rules (shared by ExamPanel + ResultPanel).
 *
 * A division may override the madrasa-wide fail mark (MadrasaDivision.failMark)
 * and then owns its own grade scales (GeneralGrade/MadrasaGrade rows with
 * divisionId = that division). Everything not overridden falls back to the
 * madrasa-wide defaults (Setting["fail_mark"] and rows with divisionId NULL).
 */

/** Division override wins; otherwise the madrasa-wide fail mark. */
export const resolveFailMark = (
  divisionFailMark: number | null | undefined,
  globalFailMark: number,
): number => (divisionFailMark === null || divisionFailMark === undefined ? globalFailMark : divisionFailMark);

/**
 * From a madrasa's full grade list, the scale that applies to `divisionId`:
 * the division's own rows if it has any, otherwise the default (NULL) rows.
 * Row order is preserved.
 */
export const pickGradeScale = <T extends { divisionId?: number | null }>(
  rows: T[],
  divisionId: number | null | undefined,
): T[] => {
  if (divisionId !== null && divisionId !== undefined) {
    const own = rows.filter((row) => row.divisionId === divisionId);
    if (own.length) return own;
  }
  // A row without a divisionId (legacy shape) is a default-scale row.
  return rows.filter((row) => row.divisionId === null || row.divisionId === undefined);
};

/**
 * A fail grade (general "F", madrasa "রাসিব") is NOT a grade band: failed
 * students automatically receive it as a fallback label, and bands cover only
 * passing marks. Legacy rows carrying these names (seeded by older versions)
 * must therefore be ignored wherever a scale is read.
 */
export const GENERAL_FAIL_GRADE_NAME = "F";
export const MADRASA_FAIL_GRADE_NAME = "রাসিব";

export const isGeneralFailGradeName = (name: unknown): boolean =>
  String(name ?? "").trim().toUpperCase() === GENERAL_FAIL_GRADE_NAME;

export const isMadrasaFailGradeName = (name: unknown): boolean =>
  String(name ?? "").trim() === MADRASA_FAIL_GRADE_NAME;

/** Drops legacy fail-named rows from a grade list. Row order is preserved. */
export const withoutFailGradeRows = <T extends { name: string }>(
  rows: T[],
  kind: "general" | "madrasa",
): T[] => {
  const isFail = kind === "general" ? isGeneralFailGradeName : isMadrasaFailGradeName;
  return rows.filter((row) => !isFail(row.name));
};
