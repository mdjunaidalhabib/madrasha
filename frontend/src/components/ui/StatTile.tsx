import { ReactNode } from "react";
import { Link } from "react-router-dom";

type StatTileVariant = "count" | "currency" | "percentage";
type StatTileTone = "blue" | "indigo" | "emerald" | "rose" | "amber" | "slate";

const TONE_CLASSES: Record<StatTileTone, { bg: string; text: string; iconBg: string; accent: string }> = {
  blue: {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-400",
    iconBg: "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300",
    accent: "bg-blue-500",
  },
  indigo: {
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    text: "text-indigo-700 dark:text-indigo-400",
    iconBg: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300",
    accent: "bg-indigo-500",
  },
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-400",
    iconBg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300",
    accent: "bg-emerald-500",
  },
  rose: {
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-400",
    iconBg: "bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300",
    accent: "bg-rose-500",
  },
  amber: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-400",
    iconBg: "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300",
    accent: "bg-amber-500",
  },
  slate: {
    bg: "bg-slate-50 dark:bg-slate-800",
    text: "text-slate-900 dark:text-slate-100",
    iconBg: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
    accent: "bg-slate-400",
  },
};

const formatValue = (value: number | string, variant: StatTileVariant) => {
  if (variant === "currency") {
    return `৳ ${Number(value || 0).toLocaleString("bn-BD")}`;
  }
  if (variant === "percentage") {
    return `${Number(value || 0).toLocaleString("bn-BD")}%`;
  }
  return typeof value === "number" ? value.toLocaleString("bn-BD") : value;
};

type StatTileSize = "md" | "sm";

type StatTileProps = {
  label: string;
  value: number | string;
  variant?: StatTileVariant;
  tone?: StatTileTone;
  to?: string;
  subLabel?: string;
  loading?: boolean;
  size?: StatTileSize;
  icon?: ReactNode;
};

export default function StatTile({
  label,
  value,
  variant = "count",
  tone = "slate",
  to,
  subLabel,
  loading,
  size = "md",
  icon,
}: StatTileProps) {
  const { bg, text, iconBg, accent } = TONE_CLASSES[tone];
  const compact = size === "sm";

  if (loading) {
    if (compact) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 pl-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="h-3 w-16 animate-pulse rounded bg-slate-200/70 dark:bg-slate-700/70" />
          <div className="mt-3 h-6 w-20 animate-pulse rounded bg-slate-200/70 dark:bg-slate-700/70" />
        </div>
      );
    }
    return (
      <div className={`rounded-2xl border border-slate-200 dark:border-slate-700 ${bg} p-5 shadow-sm`}>
        <div className="h-4 w-24 animate-pulse rounded bg-slate-200/70 dark:bg-slate-700/70" />
        <div className="mt-3 h-7 w-16 animate-pulse rounded bg-slate-200/70 dark:bg-slate-700/70" />
      </div>
    );
  }

  if (compact) {
    const compactClassName = `group relative flex items-start justify-between gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white py-4 pl-5 pr-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 ${
      to ? "transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:hover:border-slate-600" : ""
    }`;

    const compactContent = (
      <>
        <span className={`absolute inset-y-0 left-0 w-1 ${accent}`} />
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1.5 text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {formatValue(value, variant)}
          </p>
          {subLabel && <p className="mt-1 truncate text-[11px] text-slate-400 dark:text-slate-500">{subLabel}</p>}
        </div>
        {icon && (
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>{icon}</span>
        )}
      </>
    );

    if (to) {
      return (
        <Link to={to} className={compactClassName}>
          {compactContent}
        </Link>
      );
    }
    return <div className={compactClassName}>{compactContent}</div>;
  }

  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
        {icon && <span className={`shrink-0 ${text}`}>{icon}</span>}
      </div>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${text}`}>{formatValue(value, variant)}</p>
      {subLabel && <p className="mt-1 truncate text-xs text-slate-400 dark:text-slate-500">{subLabel}</p>}
    </>
  );

  const className = `block rounded-2xl border border-slate-200 dark:border-slate-700 ${bg} p-5 shadow-sm ${
    to ? "transition hover:-translate-y-0.5 hover:shadow-md" : ""
  }`;

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
