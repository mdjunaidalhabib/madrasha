import { useState } from "react";
import {
  formatDate,
  formatNumber,
  useLang,
  useText,
} from "@madrasha/shared-ui/src/i18n";
import {
  getExpiredSubscriptions,
  type ExpiredSubscription,
} from "../../../services/subscriptionApi";
import { planToolsText } from "./plan-tools.text";

export default function ExpiredMadrasaList() {
  const t = useText(planToolsText);
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ExpiredSubscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  async function load() {
    setLoading(true);
    setError(false);
    try {
      setRows(await getExpiredSubscriptions());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="overflow-hidden rounded-xl border border-amber-200 bg-white dark:border-amber-900 dark:bg-slate-900">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          if (!open) void load();
          setOpen(!open);
        }}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start text-sm font-semibold text-amber-900 dark:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-600"
      >
        <span>{t.expiredList}</span>
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="border-t border-amber-100 p-4 dark:border-amber-900">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {t.expiredHint}
            </p>
            <button
              type="button"
              disabled={loading}
              onClick={() => void load()}
              className="rounded-lg border px-3 py-1.5 text-xs dark:border-slate-600 dark:text-slate-100"
            >
              {t.refresh}
            </button>
          </div>
          {loading ? (
            <p role="status">{t.loading}</p>
          ) : error ? (
            <p role="alert" className="text-sm text-red-700 dark:text-red-300">
              {t.failed}{" "}
              <button
                type="button"
                className="underline"
                onClick={() => void load()}
              >
                {t.retry}
              </button>
            </p>
          ) : rows.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">{t.expiredEmpty}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-sm dark:text-slate-200">
                <thead>
                  <tr className="border-b text-start dark:border-slate-700">
                    {[t.name, t.end, t.days, t.students].map((label) => (
                      <th
                        key={label}
                        className="whitespace-nowrap px-3 py-2 text-start font-medium"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b last:border-0 dark:border-slate-800"
                    >
                      <td className="px-3 py-3">
                        <a
                          className="text-indigo-700 underline dark:text-indigo-300"
                          href={`/madrasas?q=${encodeURIComponent(row.name)}`}
                          title={t.openMadrasa}
                        >
                          {row.name}
                        </a>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        {formatDate(row.endDate, lang)}
                      </td>
                      <td className="px-3 py-3 tabular-nums">
                        {formatNumber(row.daysSinceExpiry, lang)}
                      </td>
                      <td className="px-3 py-3 tabular-nums">
                        {formatNumber(row.studentCount, lang)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
