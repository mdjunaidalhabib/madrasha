import { useEffect, useState } from "react";
import { cachedGet } from "../../services/api";
import PageHeader from "../../components/ui/PageHeader";
import TableSkeleton from "../../components/ui/TableSkeleton";
import EmptyState from "../../components/ui/EmptyState";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { useLanguageStore } from "../../store/languageStore";
import { LOCALE_MAP, formatNumber } from "../../utils/i18nFormat";
import {
  activityLogText,
  QUICK_DAY_OPTIONS,
  translateActivityAction,
  translateEntityName,
} from "./activity.translations";

const RETENTION_DAYS = 90;
const DEFAULT_DAYS = 30;

type ActivityRow = {
  id: number;
  user_id: number | null;
  action: string;
  entity: string;
  entity_id: number | null;
  details: string | null;
  created_at: string;
  name: string | null;
};

type FilterMode = "days" | "custom";

export default function ActivityPage() {
  const lang = useLanguageStore((s) => s.lang);
  const t = activityLogText[lang];

  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 50;

  const [mode, setMode] = useState<FilterMode>("days");
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const load = async () => {
    setLoading(true);
    try {
      const params =
        mode === "custom"
          ? { from: appliedFrom || undefined, to: appliedTo || undefined, page, limit }
          : { days, page, limit };
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
  }, [mode, days, appliedFrom, appliedTo, page]);

  const selectDays = (n: number) => {
    setMode("days");
    setDays(n);
    setPage(1);
  };

  const applyCustomRange = () => {
    setMode("custom");
    setAppliedFrom(fromInput);
    setAppliedTo(toInput);
    setPage(1);
  };

  const resetFilters = () => {
    setMode("days");
    setDays(DEFAULT_DAYS);
    setFromInput("");
    setToInput("");
    setAppliedFrom("");
    setAppliedTo("");
    setPage(1);
  };

  return (
    <div>
      <PageHeader title={t.title} subtitle={t.subtitle} />

      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div>
          <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">{t.quickRangeLabel}</div>
          <div className="flex flex-wrap gap-2">
            {QUICK_DAY_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => selectDays(n)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                  mode === "days" && days === n
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {t.dayOption(n)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{t.customRangeLabel}</div>
          <div>
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">{t.fromLabel}</label>
            <Input type="date" className="h-10 w-40" value={fromInput} onChange={(e) => setFromInput(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">{t.toLabel}</label>
            <Input type="date" className="h-10 w-40" value={toInput} onChange={(e) => setToInput(e.target.value)} />
          </div>
          <Button variant="primary" onClick={applyCustomRange} disabled={!fromInput && !toInput}>
            {t.applyLabel}
          </Button>
          <Button variant="secondary" onClick={resetFilters}>
            {t.clearLabel}
          </Button>
          <div className="ml-auto text-xs text-slate-400 dark:text-slate-500">
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
              <tr className="text-left text-sm text-gray-600 dark:text-slate-400">
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
                  <td className="px-4 py-3">{r.name || t.systemUser}</td>
                  <td className="px-4 py-3">{translateActivityAction(r.entity, r.action, lang)}</td>
                  <td className="px-4 py-3">{translateEntityName(r.entity, lang)}</td>
                  <td className="px-4 py-3">{r.details || t.noDetails}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString(LOCALE_MAP[lang])}
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
