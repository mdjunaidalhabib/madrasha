import { Link } from "react-router-dom";

type StatTileVariant = "count" | "currency" | "percentage";
type StatTileTone = "blue" | "indigo" | "emerald" | "rose" | "amber" | "slate";

const TONE_CLASSES: Record<StatTileTone, { bg: string; text: string }> = {
  blue: { bg: "bg-blue-50", text: "text-blue-700" },
  indigo: { bg: "bg-indigo-50", text: "text-indigo-700" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-700" },
  rose: { bg: "bg-rose-50", text: "text-rose-700" },
  amber: { bg: "bg-amber-50", text: "text-amber-700" },
  slate: { bg: "bg-slate-50", text: "text-slate-900" },
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

type StatTileProps = {
  label: string;
  value: number | string;
  variant?: StatTileVariant;
  tone?: StatTileTone;
  to?: string;
  subLabel?: string;
  loading?: boolean;
};

export default function StatTile({
  label,
  value,
  variant = "count",
  tone = "slate",
  to,
  subLabel,
  loading,
}: StatTileProps) {
  const { bg, text } = TONE_CLASSES[tone];

  if (loading) {
    return (
      <div className={`rounded-2xl border border-slate-200 ${bg} p-5 shadow-sm`}>
        <div className="h-4 w-24 animate-pulse rounded bg-slate-200/70" />
        <div className="mt-3 h-7 w-16 animate-pulse rounded bg-slate-200/70" />
      </div>
    );
  }

  const content = (
    <>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${text}`}>{formatValue(value, variant)}</p>
      {subLabel && <p className="mt-1 text-xs text-slate-400">{subLabel}</p>}
    </>
  );

  const className = `block rounded-2xl border border-slate-200 ${bg} p-5 shadow-sm ${
    to ? "transition hover:shadow-md" : ""
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
