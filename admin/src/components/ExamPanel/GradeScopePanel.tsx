import { Layers } from "lucide-react";
import { localizeDigits, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { examPanelText } from "./examPanel.text";
import { hasOwnGrading, type DivisionFailMark } from "./divisionGrading";
import DivisionStatusChip from "./DivisionStatusChip";

/** null = the madrasa-wide default scale. */
export type GradeScope = number | null;

const itemClass = (active: boolean) =>
  `w-full rounded-xl border px-3 py-2.5 text-start transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
    active
      ? "border-blue-500 bg-blue-50 shadow-sm dark:border-blue-500 dark:bg-blue-950/30"
      : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800"
  }`;

const pillClass = (active: boolean) =>
  `inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
    active
      ? "border-blue-600 bg-blue-600 text-white"
      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
  }`;

/** Scope picker: a sticky list with status chips on lg+, a scrollable pill
 * row on smaller screens. Lists the default scope plus EVERY division. */
export default function GradeScopePanel({
  divisions,
  defaultFailMark,
  selected,
  onSelect,
}: {
  divisions: DivisionFailMark[];
  defaultFailMark: number;
  selected: GradeScope;
  onSelect: (scope: GradeScope) => void;
}) {
  const t = useText(examPanelText);
  const lang = useLang();
  const toBanglaDigits = (v: string | number) => localizeDigits(v, lang);
  return (
    <>
      {/* Mobile / tablet: horizontally scrollable pills */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1 lg:hidden">
        <div className="flex gap-2" role="group" aria-label={t.gradingScope}>
          <button
            type="button"
            aria-pressed={selected === null}
            onClick={() => onSelect(null)}
            className={pillClass(selected === null)}
          >
            <Layers size={14} />
            {t.defaultShort}
          </button>
          {divisions.map((d) => {
            const active = selected === d.division_id;
            return (
              <button
                key={d.division_id}
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(d.division_id)}
                className={pillClass(active)}
              >
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${
                    hasOwnGrading(d) ? (active ? "bg-white" : "bg-blue-500") : active ? "bg-white/50" : "bg-slate-300 dark:bg-slate-600"
                  }`}
                />
                {d.name}
                {hasOwnGrading(d) && (
                  <span className={`text-xs font-semibold ${active ? "text-blue-100" : "text-blue-600 dark:text-blue-400"}`}>
                    {toBanglaDigits(d.fail_mark as number)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop: sticky side panel */}
      <aside
        aria-label={t.gradingScope}
        className="sticky top-4 hidden max-h-[calc(100vh-2rem)] w-64 shrink-0 self-start overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:block"
      >
        <button
          type="button"
          aria-current={selected === null ? "true" : undefined}
          onClick={() => onSelect(null)}
          className={itemClass(selected === null)}
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Layers size={15} className="text-emerald-600 dark:text-emerald-400" />
            {t.defaultAll}
          </div>
          <span className="mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
            {t.failMarkN(toBanglaDigits(defaultFailMark))}
          </span>
        </button>

        <div className="my-2 flex items-center gap-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {t.divisions}
          <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          {toBanglaDigits(divisions.length)}
        </div>

        {divisions.length === 0 && (
          <p className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{t.noDivision}</p>
        )}

        <div className="space-y-1">
          {divisions.map((d) => {
            const active = selected === d.division_id;
            return (
              <button
                key={d.division_id}
                type="button"
                aria-current={active ? "true" : undefined}
                onClick={() => onSelect(d.division_id)}
                className={itemClass(active)}
              >
                <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{d.name}</div>
                <DivisionStatusChip failMark={d.fail_mark} className="mt-1" />
              </button>
            );
          })}
        </div>
      </aside>
    </>
  );
}
