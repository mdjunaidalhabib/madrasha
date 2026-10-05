import type { ReactNode } from "react";
import { formatNumber, localizeDigits, useLang } from "@madrasha/shared-ui/src/i18n";

/**
 * Small presentational pieces shared by the attendance v3 pages
 * (dashboard, payroll, leaves, sessions). Text-free - callers pass labels.
 */

export const labelClass = "mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400";

export const fieldClass =
  "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800/60";

export const cardClass =
  "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900";

export const thClass =
  "px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";

export const tdClass = "px-3 py-2 text-sm text-slate-700 dark:text-slate-200";

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

export function Tabs<K extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ key: K; label: string; count?: number | null }>;
  value: K;
  onChange: (key: K) => void;
}) {
  const lang = useLang();
  return (
    <div className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist">
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition ${
              active
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800"
            }`}
          >
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span
                className={`rounded-full px-1.5 text-xs tabular-nums ${
                  active ? "bg-white/25 text-white" : "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                }`}
              >
                {formatNumber(tab.count, lang)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export const rateTone = (rate: number, low = 75) =>
  rate >= 90 ? "bg-emerald-500" : rate >= low ? "bg-amber-500" : "bg-rose-500";

/** Horizontal percentage bar with the number beside it. */
export function RateBar({ rate, low }: { rate: number; low?: number }) {
  const lang = useLang();
  const value = Math.max(0, Math.min(100, Number(rate) || 0));
  return (
    <div className="flex min-w-[120px] items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className={`h-full rounded-full ${rateTone(value, low)}`} style={{ width: `${value}%` }} />
      </div>
      <span className="w-12 text-end text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">
        {localizeDigits(formatPercent(value), lang)}%
      </span>
    </div>
  );
}

export const formatPercent = (value: number) => {
  const n = Number(value) || 0;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};

export function Panel({
  title,
  actions,
  children,
  className = "",
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${cardClass} ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{title}</h2>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyRow({ text }: { text: string }) {
  return <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">{text}</div>;
}

/** Message from an axios error, or the fallback. */
export const errorMessage = (err: unknown, fallback: string) =>
  ((err as any)?.response?.data?.message as string | undefined) || fallback;
