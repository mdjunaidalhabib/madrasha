import type { ReactNode } from "react";
import { Briefcase, GraduationCap, RefreshCw, Search, Users, X } from "lucide-react";
import FilterSelect from "../../../components/common/FilterSelect";
import { useText, useLang, localizeDigits } from "@madrasha/shared-ui/src/i18n";
import { type PeopleTab } from "./photoManager";
import { peopleToolsText } from "./peopleTools.text";
import type { PeopleDirectory } from "./usePeopleDirectory";

const TAB_ICONS: Record<PeopleTab, typeof Users> = { students: GraduationCap, teachers: Users, staff: Briefcase };

/** শিক্ষার্থী | শিক্ষক | স্টাফ switcher (hidden when only one tab is allowed). */
export function PeopleTabs({ dir, disabled }: { dir: PeopleDirectory; disabled?: boolean }) {
  const pt = useText(peopleToolsText);
  if (dir.tabs.length < 2) return null;
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900 sm:self-start">
      {dir.tabs.map((t) => {
        const Icon = TAB_ICONS[t];
        return (
          <button
            key={t}
            type="button"
            disabled={disabled}
            onClick={() => dir.setTab(t)}
            className={`inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition disabled:opacity-50 ${
              dir.tab === t
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            <Icon className="h-4 w-4" /> {pt.tabs[t]}
          </button>
        );
      })}
    </div>
  );
}

/** "মোট · done · বাকি" with a percentage bar. */
export function ProgressSummary({
  scopeLabel,
  total,
  done,
  doneLabel,
  remainingLabel,
}: {
  scopeLabel: string;
  total: number;
  done: number;
  doneLabel: string;
  remainingLabel?: string;
}) {
  const pt = useText(peopleToolsText);
  const lang = useLang();
  const toBanglaDigits = (v: string | number) => localizeDigits(v, lang);
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-slate-600 dark:text-slate-300">
          <span className="font-semibold text-slate-800 dark:text-slate-100">{scopeLabel}</span>
          <span className="mx-2 text-slate-300 dark:text-slate-600">|</span>
          {pt.total} <b className="text-slate-900 dark:text-white">{toBanglaDigits(total)}</b>
          <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
          {doneLabel} <b className="text-emerald-600 dark:text-emerald-400">{toBanglaDigits(done)}</b>
          <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
          {remainingLabel ?? pt.remaining} <b className="text-amber-600 dark:text-amber-400">{toBanglaDigits(total - done)}</b>
        </div>
        <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{toBanglaDigits(percent)}%</div>
      </div>
      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/** Small segmented control with counts (সব / ছবি নেই / ছবি আছে ...). */
export function SegmentedFilter<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
}) {
  const lang = useLang();
  return (
    <div className="inline-flex flex-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800 lg:flex-none">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`inline-flex h-8 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition lg:flex-none ${
            value === o.value
              ? "bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-300"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          }`}
        >
          {o.label}
          {o.count !== undefined && (
            <span className="rounded-full bg-slate-200/70 px-1.5 text-[10px] dark:bg-slate-600/60">
              {localizeDigits(o.count, lang)}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Search + বিভাগ + শ্রেণি, with a page-specific slot (status pills) and refresh. */
export function PeopleFilterBar({
  dir,
  right,
  disabled,
}: {
  dir: PeopleDirectory;
  right?: ReactNode;
  /** Locks scope changes (e.g. while there are unsaved edits). */
  disabled?: boolean;
}) {
  const { tab } = dir;
  const pt = useText(peopleToolsText);
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <div className="relative col-span-2 sm:w-[240px]">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={dir.search}
            onChange={(e) => dir.setSearch(e.target.value)}
            placeholder={tab === "students" ? pt.searchStudents : pt.searchOthers}
            className="h-9 w-full rounded-md border border-gray-300 ps-8 pe-8 text-sm outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          {dir.search && (
            <button
              type="button"
              onClick={() => dir.setSearch("")}
              className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
              aria-label={pt.clearSearch}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {tab !== "staff" && (
          <FilterSelect
            value={dir.division}
            onChange={dir.setDivision}
            disabled={disabled}
            wrapperClassName={tab === "students" ? "w-full sm:w-[150px]" : "col-span-2 w-full sm:w-[150px]"}
          >
            <option value="">{pt.allDivisions}</option>
            {dir.divisions.map((d) => (
              <option key={d.division_id} value={d.division_id}>
                {d.division_name_bn}
              </option>
            ))}
          </FilterSelect>
        )}

        {tab === "students" && (
          <FilterSelect
            value={dir.classId}
            onChange={dir.setClassId}
            disabled={disabled}
            wrapperClassName="w-full sm:w-[170px]"
          >
            <option value="">{pt.allClasses}</option>
            {dir.classOptions.map((c) => (
              <option key={c.class_id} value={c.class_id}>
                {c.class_name_bn}
              </option>
            ))}
          </FilterSelect>
        )}
      </div>

      <div className="flex items-center gap-2">
        {right}
        <button
          type="button"
          onClick={dir.reload}
          disabled={dir.loading || disabled}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
          title={pt.refresh}
          aria-label={pt.refresh}
        >
          <RefreshCw className={`h-4 w-4 ${dir.loading ? "animate-spin" : ""}`} />
        </button>
      </div>
    </div>
  );
}

/** Amber "view only" + red load-error notices shared by the people tools. */
export function PeopleNotices({ dir, readOnlyText }: { dir: PeopleDirectory; readOnlyText: string }) {
  return (
    <>
      {!dir.tabCanEdit && !dir.loading && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
          {readOnlyText}
        </div>
      )}
      {dir.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
          {dir.error}
        </div>
      )}
    </>
  );
}
