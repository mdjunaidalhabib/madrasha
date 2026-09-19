export type DivisionFailMark = {
  division_id: number;
  name: string;
  /** Override only - null means the division follows the default fail mark. */
  fail_mark: number | null;
  has_custom_grades: boolean;
};

/** A division "has its own grading" once it carries a fail-mark override
 * (the server clones the default grades into it at the same moment). */
export const hasOwnGrading = (d: Pick<DivisionFailMark, "fail_mark"> | null | undefined): boolean =>
  d != null && d.fail_mark !== null && d.fail_mark !== undefined;

/** Defensive parse of GET /fail-mark/divisions. */
export const parseDivisionList = (data: any): DivisionFailMark[] =>
  Array.isArray(data?.divisions) ? (data.divisions as DivisionFailMark[]) : [];

/** Validates a fail-mark draft; returns the integer or null when invalid. */
export const parseFailMarkDraft = (draft: string): number | null => {
  if (draft.trim() === "") return null;
  const value = Number(draft);
  return Number.isInteger(value) && value >= 0 && value <= 100 ? value : null;
};
