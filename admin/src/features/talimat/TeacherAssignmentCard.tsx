import { useId, useState } from "react";
import { ChevronDown, ChevronRight, ChevronUp, Pencil, Trash2, Users } from "lucide-react";
import { localizeDigits, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { teacherAssignmentText } from "./teacherAssignment.text";

export type Assignment = {
  teacher_id: number;
  teacher_name: string;
  class_id: number;
  books: { book_id: number; book_name_bn: string }[];
};
type AssignmentClass = { class_id: number; class_name_bn: string; division_id: number };

export default function TeacherAssignmentCard({
  assignments,
  classes,
  divisions,
  onEdit,
  onRemove,
}: {
  assignments: Assignment[];
  classes: Map<number, AssignmentClass>;
  divisions: { division_id: number; division_name_bn: string }[];
  onEdit: (assignment: Assignment) => void;
  onRemove: (assignment: Assignment) => void;
}) {
  const t = useText(teacherAssignmentText);
  const lang = useLang();
  const n = (value: number) => localizeDigits(value, lang);
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const teacher = assignments[0];
  const total = assignments.reduce((count, assignment) => count + assignment.books.length, 0);
  const divisionCount = new Set(
    assignments
      .map((assignment) => classes.get(assignment.class_id)?.division_id)
      .filter((id) => id != null),
  ).size;
  let offset = 0;
  const visibleGroups = assignments
    .map((assignment) => {
      const start = offset;
      offset += assignment.books.length;
      return {
        assignment,
        start,
        books: expanded ? assignment.books : assignment.books.slice(0, Math.max(0, 4 - start)),
      };
    })
    .filter((group) => group.books.length);

  return (
    <article
      aria-label={teacher.teacher_name}
      className="flex min-h-[420px] min-w-0 flex-col self-start overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex h-32 shrink-0 items-start gap-2 p-4 sm:p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
          <Users size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <h3
            title={teacher.teacher_name}
            className="line-clamp-2 break-words font-semibold leading-snug text-slate-900 dark:text-slate-100"
          >
            {teacher.teacher_name}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {t.assignmentCounts(n(divisionCount), n(assignments.length), n(total))}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => onEdit(teacher)}
            aria-label={`${t.edit}: ${teacher.teacher_name}`}
            title={t.edit}
            className="rounded-lg p-2 text-indigo-600 transition hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-400 dark:hover:bg-slate-800"
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            onClick={() => onRemove(teacher)}
            aria-label={`${t.remove}: ${teacher.teacher_name}`}
            title={t.remove}
            className="rounded-lg p-2 text-rose-500 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:text-rose-400 dark:hover:bg-slate-800"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <div
        id={listId}
        aria-label={`${t.assignments}: ${teacher.teacher_name}`}
        className="flex-1 space-y-4 border-t border-slate-100 px-4 py-4 sm:px-5 dark:border-slate-800"
      >
        {visibleGroups.map(({ assignment, books, start }) => {
          const assignedClass = classes.get(assignment.class_id);
          const division = divisions.find((d) => d.division_id === assignedClass?.division_id);
          return (
            <div key={assignment.class_id}>
              <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
                {division && (
                  <>
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {division.division_name_bn}
                    </span>
                    <ChevronRight size={12} aria-hidden="true" className="text-slate-400" />
                  </>
                )}
                <h4 className="rounded-md bg-indigo-50/70 px-2 py-1 font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                  {assignedClass?.class_name_bn || `${t.class} #${n(assignment.class_id)}`}
                </h4>
              </div>
              <ol start={start + 1} className="space-y-2">
                {books.map((book, index) => (
                  <li
                    key={book.book_id}
                    className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300"
                  >
                    <span className="min-w-5 shrink-0 text-xs leading-6 text-slate-400">
                      {n(start + index + 1)}.
                    </span>
                    <span className="min-w-0 break-words">{book.book_name_bn}</span>
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>
      <div className="flex h-11 shrink-0 border-t border-slate-100 dark:border-slate-800">
        {total > 4 && (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center justify-center gap-2 px-4 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 dark:text-indigo-300 dark:hover:bg-slate-800"
          >
            {expanded ? t.showLess : t.showAllBooks(n(total))}
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        )}
      </div>
    </article>
  );
}
