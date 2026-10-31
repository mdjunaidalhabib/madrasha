export type SubjectResult = "missing" | "absent" | "fail" | "pass";

/** Compare raw marks with the subject override, then the class's pass mark.
 * The student's overall status never changes an individual subject's result. */
export function getSubjectResult(
  subject: {
    mark?: number | string | null;
    is_absent?: boolean;
    pass_mark?: number | string | null;
  } | null | undefined,
  fallbackPassMark?: number | null,
): SubjectResult {
  if (!subject) return "missing";
  if (subject.is_absent) return "absent";
  if (subject.mark == null || subject.mark === "") return "missing";
  const mark = Number(subject.mark);
  const threshold = subject.pass_mark ?? fallbackPassMark;
  if (!Number.isFinite(mark) || threshold == null || threshold === "" || !Number.isFinite(Number(threshold))) {
    return "missing";
  }
  return mark < Number(threshold) ? "fail" : "pass";
}
