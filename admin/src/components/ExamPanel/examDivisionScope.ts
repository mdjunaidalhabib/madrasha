import { useEffect } from "react";

/**
 * বিভাগভিত্তিক পরীক্ষা - client helpers for the division scope GET /exams
 * returns on every exam (`division_ids`, empty = সকল বিভাগ).
 */

export type ExamDivisionRef = { division_id: number; division_name_bn: string | null };

export type DivisionScoped = {
  division_ids?: number[] | null;
  divisions?: ExamDivisionRef[] | null;
};

/** Whether an exam is held for the given division. No division picked yet
 * ("" / "all") shows every exam; an unscoped exam covers every division. */
export function examCoversDivision(exam: DivisionScoped, divisionId: string | number | null | undefined): boolean {
  if (divisionId === undefined || divisionId === null || divisionId === "" || divisionId === "all") return true;
  const ids = exam.division_ids ?? [];
  return ids.length === 0 || ids.includes(Number(divisionId));
}

export function examsForDivision<T extends DivisionScoped>(exams: T[], divisionId: string | number | null | undefined): T[] {
  return exams.filter((exam) => examCoversDivision(exam, divisionId));
}

/** Short Bangla label for an exam's scope, e.g. "সকল বিভাগ" / "হিফজ, কিতাব". */
export function examScopeLabel(exam: DivisionScoped): string {
  const names = (exam.divisions ?? []).map((d) => d.division_name_bn).filter(Boolean);
  return names.length ? names.join(", ") : "সকল বিভাগ";
}

/** Divisions an exam is held for (all of them for a সকল বিভাগ exam / no exam
 * picked yet) - for pages where the exam is chosen before the division. */
export function divisionsForExam<D extends { division_id: number | string }>(
  divisions: D[],
  exam: DivisionScoped | null | undefined,
): D[] {
  const ids = exam?.division_ids ?? [];
  if (!ids.length) return divisions;
  return divisions.filter((d) => ids.includes(Number(d.division_id)));
}

/** Clears a picked exam/division pair that no longer fits together (e.g. the
 * user switched to a division the exam isn't held for). Only acts once the
 * exam is actually in the loaded list, so a URL-hydrated exam id is never
 * dropped just because the list hasn't arrived yet. */
export function useClearMismatchedExam(
  exams: (DivisionScoped & { id: string | number })[],
  examId: string | number | null | undefined,
  divisionId: string | number | null | undefined,
  clear: () => void,
) {
  useEffect(() => {
    if (!examId) return;
    const exam = exams.find((e) => String(e.id) === String(examId));
    if (exam && !examCoversDivision(exam, divisionId)) clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exams, examId, divisionId]);
}
