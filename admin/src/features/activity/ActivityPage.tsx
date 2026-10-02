import { useEffect, useState } from "react";
import { cachedGet } from "../../services/api";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import TableSkeleton from "@madrasha/shared-ui/src/components/ui/TableSkeleton";
import EmptyState from "@madrasha/shared-ui/src/components/ui/EmptyState";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import DateRangePicker from "./DateRangePicker";
import { formatDateTime, formatNumber, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import {
  type ActivityLogText,
  activityText,
  formatJsonDetails,
  QUICK_DAY_OPTIONS,
  translateActivityAction,
  translateEntityName,
} from "./activity.text";

const RETENTION_DAYS = 90;
const DEFAULT_DAYS = 3;

type ActivityRow = {
  id: number;
  user_id: number | null;
  action: string;
  entity: string;
  entity_id: number | null;
  details: string | null;
  created_at: string;
  name: string | null;
  role_name: string | null;
};

type FilterMode = "days" | "custom";

const COLLAPSED_LINES = 4;

// Super-admin rows carry no acting tenant user (user_id is null) - name the
// actor instead of showing the generic "System".
const isSuperAdminAction = (action: string) => action.startsWith("SUPER_ADMIN_") || action === "MADRASA_CREATED";

/**
 * Backend details are multi-line: a headline (whose record it was), then one
 * line per change ("field: old → new") or bulk-update student. Long ones
 * collapse behind a "show more" toggle so one bulk import can't flood the table.
 */
function ActivityDetails({ text, t }: { text: string; t: ActivityLogText }) {
  const lang = useLang();
  const [expanded, setExpanded] = useState(false);
  // JSON details (super-admin / result workflow) have no headline - just
  // translated "label: value" lines.
  const json = formatJsonDetails(text, lang, t);
  const [headline, ...lines] = json ? ["", ...json] : text.split("\n").filter((line) => line.trim());
  const hidden = lines.length - COLLAPSED_LINES;
  const visible = expanded || hidden <= 0 ? lines : lines.slice(0, COLLAPSED_LINES);

  return (
    <div className="min-w-[260px] max-w-[640px]">
      {headline && <div className="font-medium text-slate-800 dark:text-slate-100">{headline}</div>}
      {visible.length > 0 && (
        <ul className="mt-1 space-y-0.5 first:mt-0 text-[13px] text-slate-600 dark:text-slate-400">
          {visible.map((raw, i) => {
            // Every 4 leading spaces = one nesting level under the line above
            // (bulk logs: class → student → that student's changes).
            const depth = Math.min(2, Math.floor((raw.length - raw.trimStart().length) / 4));
            const line = raw.trim();
            const itemClass = depth === 2 ? "ps-8" : depth === 1 ? "ps-4" : undefined;
            const arrow = line.indexOf(" → ");
            if (arrow === -1 || line.indexOf(" → ", arrow + 1) !== -1) {
              return (
                <li key={i} className={itemClass}>
                  {line}
                </li>
              );
            }
            const colon = line.lastIndexOf(": ", arrow);
            return (
              <li key={i} className={itemClass}>
                {colon > -1 && <span className="text-slate-500 dark:text-slate-400">{line.slice(0, colon + 1)} </span>}
                <span className="text-rose-600 line-through decoration-rose-300 dark:text-rose-400">
                  {line.slice(colon > -1 ? colon + 2 : 0, arrow)}
                </span>
                <span className="mx-1 text-slate-400">→</span>
                <span className="font-medium text-emerald-700 dark:text-emerald-400">{line.slice(arrow + 3)}</span>
              </li>
            );
          })}
        </ul>
      )}
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          {expanded ? t.showLess : t.showMore(formatNumber(hidden, lang))}
        </button>
      )}
    </div>
  );
}

export default function ActivityPage() {
  const lang = useLang();
  const t = useText(activityText);

  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 50;

  const [mode, setMode] = useState<FilterMode>("days");
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");
  // "security" = only login/logout/failed-login rows.
  const [category, setCategory] = useState<"" | "security">("");

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const load = async () => {
    setLoading(true);
    try {
      const params =
        mode === "custom"
          ? { from: appliedFrom || undefined, to: appliedTo || undefined, page, limit, entity: category || undefined }
          : { days, page, limit, entity: category || undefined };
      const res = await cachedGet("/activity", { params });
      setRows(res.data.rows ?? []);
      setTotal(res.data.total ?? 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, days, appliedFrom, appliedTo, page, category]);

  const selectDays = (n: number) => {
    setMode("days");
    setDays(n);
    setPage(1);
  };

  const applyCustomRange = (from: string, to: string) => {
    setMode("custom");
    setAppliedFrom(from);
    setAppliedTo(to);
    setPage(1);
  };

  const selectCategory = (value: "" | "security") => {
    setCategory(value);
    setPage(1);
  };

  const resetFilters = () => {
    setCategory("");
    setMode("days");
    setDays(DEFAULT_DAYS);
    setAppliedFrom("");
    setAppliedTo("");
    setPage(1);
  };

  return (
    <div>
      <PageHeader title={t.title} subtitle={t.subtitle} />

      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div>
          <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">{t.categoryLabel}</div>
          <div className="flex flex-wrap gap-2">
            {([
              ["", t.categoryAll],
              ["security", t.categorySecurity],
            ] as const).map(([value, label]) => (
              <button
                key={value || "all"}
                onClick={() => selectCategory(value)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                  category === value
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">{t.quickRangeLabel}</div>
          <div className="flex flex-wrap items-center gap-2">
            {QUICK_DAY_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => selectDays(n)}
                className={`h-9 rounded-full px-3.5 text-sm font-medium transition ${
                  mode === "days" && days === n
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {t.dayOption(formatNumber(n, lang))}
              </button>
            ))}
            <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block dark:bg-slate-700" aria-hidden />
            <DateRangePicker
              from={appliedFrom}
              to={appliedTo}
              active={mode === "custom"}
              retentionDays={RETENTION_DAYS}
              onApply={applyCustomRange}
              onClear={resetFilters}
            />
          </div>
          <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            {t.retentionNote(formatNumber(RETENTION_DAYS, lang))}
          </div>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={10} />
      ) : rows.length === 0 ? (
        <EmptyState title={t.empty} />
      ) : (
        <div className="bg-white rounded shadow overflow-x-auto dark:bg-slate-900">
          <table className="w-full min-w-[640px]">
            <thead className="bg-gray-50 dark:bg-slate-800">
              <tr className="text-start text-sm text-gray-600 dark:text-slate-400">
                <th className="px-4 py-3">{t.colUser}</th>
                <th className="px-4 py-3">{t.colAction}</th>
                <th className="px-4 py-3">{t.colEntity}</th>
                <th className="px-4 py-3">{t.colDetails}</th>
                <th className="px-4 py-3">{t.colTime}</th>
              </tr>
            </thead>
            <tbody className="text-sm dark:text-slate-300">
              {rows.map((r) => (
                <tr key={r.id} className="border-t dark:border-slate-700">
                  {/* Role, not the person's name; the name stays in the hover title. */}
                  <td className="px-4 py-3" title={r.name ?? undefined}>
                    {r.role_name || r.name || (isSuperAdminAction(r.action) ? t.superAdminUser : t.systemUser)}
                  </td>
                  <td className="px-4 py-3">{translateActivityAction(r.entity, r.action, t)}</td>
                  <td className="px-4 py-3">{translateEntityName(r.entity, t)}</td>
                  <td className="px-4 py-3">
                    {r.details ? <ActivityDetails text={r.details} t={t} /> : t.noDetails}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatDateTime(r.created_at, lang)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400">{t.totalLabel(formatNumber(total, lang))}</span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                {t.prevPage}
              </Button>
              <span className="text-slate-500 dark:text-slate-400">
                {t.pageLabel(formatNumber(page, lang), formatNumber(totalPages, lang))}
              </span>
              <Button
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                {t.nextPage}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
