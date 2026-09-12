import { ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Cell,
  Legend,
  Line,
  LineChart,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Banknote, Receipt, Wallet } from "lucide-react";
import { cachedGet } from "../../services/api";
import Card from "@madrasha/shared-ui/src/components/ui/Card";
import ChartCard from "@madrasha/shared-ui/src/components/ui/ChartCard";
import { useThemeStore } from "@madrasha/shared-ui/src/store/themeStore";
import { money } from "../accounts/accountHelpers";

type FeeDashboardData = {
  totalInvoiced: number;
  totalCollected: number;
  totalDue: number;
  totalWaived: number;
  invoiceCount: number;
  statusBreakdown: { unpaid: number; partiallyPaid: number; paid: number; waived: number };
  overdue: { count: number; amount: number };
  collectionTrend: { period: string; total: number }[];
};

const STATUS_COLORS = {
  unpaid: "#e11d48",
  partiallyPaid: "#d97706",
  paid: "#059669",
  waived: "#94a3b8",
};

const STAT_TONES = {
  emerald: {
    border: "border-emerald-100 dark:border-emerald-900/40",
    bg: "from-emerald-50 dark:from-emerald-950/30",
    blob: "bg-emerald-400/20",
    icon: "from-emerald-500 to-teal-500 shadow-emerald-500/30",
    glow: "hover:shadow-emerald-900/10",
  },
  indigo: {
    border: "border-indigo-100 dark:border-indigo-900/40",
    bg: "from-indigo-50 dark:from-indigo-950/30",
    blob: "bg-indigo-400/20",
    icon: "from-indigo-500 to-blue-500 shadow-indigo-500/30",
    glow: "hover:shadow-indigo-900/10",
  },
  amber: {
    border: "border-amber-100 dark:border-amber-900/40",
    bg: "from-amber-50 dark:from-amber-950/30",
    blob: "bg-amber-400/20",
    icon: "from-amber-500 to-yellow-500 shadow-amber-500/30",
    glow: "hover:shadow-amber-900/10",
  },
  rose: {
    border: "border-rose-100 dark:border-rose-900/40",
    bg: "from-rose-50 dark:from-rose-950/30",
    blob: "bg-rose-400/20",
    icon: "from-rose-500 to-orange-500 shadow-rose-500/30",
    glow: "hover:shadow-rose-900/10",
  },
} as const;

type StatTone = keyof typeof STAT_TONES;

const PremiumStat = ({
  icon,
  label,
  value,
  subLabel,
  tone,
  to,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  subLabel?: string;
  tone: StatTone;
  to?: string;
}) => {
  const t = STAT_TONES[tone];
  const content = (
    <div
      className={`group relative h-full overflow-hidden rounded-2xl border ${t.border} bg-gradient-to-br ${t.bg} via-white to-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${t.glow} dark:via-slate-900 dark:to-slate-900`}
    >
      <div className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full ${t.blob} blur-2xl transition-transform duration-300 group-hover:scale-110`} />
      <span className={`relative inline-flex rounded-2xl bg-gradient-to-br ${t.icon} p-3 text-white shadow-lg`}>{icon}</span>
      <p className="relative mt-4 text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="relative mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{value}</p>
      <p className="relative mt-1 truncate text-xs text-slate-400 dark:text-slate-500">{subLabel || " "}</p>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
};

const PremiumStatSkeleton = () => (
  <div className="h-full rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm dark:border-slate-700/60 dark:bg-slate-900">
    <div className="h-11 w-11 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-700/70" />
    <div className="mt-4 h-4 w-20 animate-pulse rounded bg-slate-200/70 dark:bg-slate-700/70" />
    <div className="mt-2 h-7 w-28 animate-pulse rounded bg-slate-200/70 dark:bg-slate-700/70" />
    <div className="mt-2 h-3 w-16 animate-pulse rounded bg-slate-200/70 dark:bg-slate-700/70" />
  </div>
);

export default function FeeDashboardPage() {
  const [data, setData] = useState<FeeDashboardData | null>(null);
  const isDark = useThemeStore((s) => s.theme) === "dark";
  const gridColor = isDark ? "#334155" : "#e2e8f0";
  const axisColor = isDark ? "#64748b" : "#94a3b8";

  useEffect(() => {
    (async () => {
      const res = await cachedGet<{ success: boolean; data: FeeDashboardData }>("/invoices/summary", undefined, 0);
      setData((res.data as any)?.data ?? null);
    })();
  }, []);

  const loading = !data;

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: isDark ? "#1e293b" : "#ffffff",
      border: `1px solid ${gridColor}`,
      borderRadius: 12,
      fontSize: 13,
    },
    labelStyle: { color: isDark ? "#e2e8f0" : "#0f172a" },
  };

  const statusPieData = data
    ? [
        { name: "পরিশোধিত", value: data.statusBreakdown.paid, key: "paid" },
        { name: "আংশিক পরিশোধিত", value: data.statusBreakdown.partiallyPaid, key: "partiallyPaid" },
        { name: "অপরিশোধিত", value: data.statusBreakdown.unpaid, key: "unpaid" },
        { name: "মওকুফকৃত", value: data.statusBreakdown.waived, key: "waived" },
      ].filter((row) => row.value > 0)
    : [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:col-span-4 xl:grid-cols-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <PremiumStatSkeleton key={i} />)
          ) : (
            <>
              <PremiumStat label="মোট বিলকৃত" value={money(data.totalInvoiced)} tone="indigo" icon={<Receipt size={20} />} />
              <PremiumStat label="মোট আদায়" value={money(data.totalCollected)} tone="emerald" icon={<Wallet size={20} />} />
              <PremiumStat label="মোট বকেয়া" value={money(data.totalDue)} tone="amber" icon={<Banknote size={20} />} />
              <PremiumStat
                label="ওভারডিউ"
                value={money(data.overdue.amount)}
                subLabel={`${Number(data.overdue.count).toLocaleString("bn-BD")} টি চালান`}
                tone="rose"
                icon={<AlertTriangle size={20} />}
                to="/fee/overdue-fee"
              />
            </>
          )}
        </div>

        <Card className="flex h-full flex-col justify-center gap-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            দ্রুত অ্যাকশন
          </p>
          <Link
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-emerald-500"
            to="/fee-collection"
          >
            ফি গ্রহণ
          </Link>
          <Link
            className="rounded-xl bg-amber-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-amber-500"
            to="/fee/pending-fee"
          >
            ভর্তি ফি পেন্ডিং
          </Link>
          <Link
            className="rounded-xl bg-rose-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-rose-500"
            to="/fee/overdue-fee"
          >
            বকেয়া ফী
          </Link>
          <Link
            className="rounded-xl bg-slate-800 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
            to="/fee-management"
          >
            ফি সেটাপ
          </Link>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <ChartCard
          title="ফি আদায়ের প্রবণতা"
          subtitle="গত ১২ মাস"
          loading={loading}
          empty={!loading && !data?.collectionTrend?.length}
          className="xl:col-span-2"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data?.collectionTrend || []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="period" stroke={axisColor} tick={{ fontSize: 12 }} />
              <YAxis stroke={axisColor} tick={{ fontSize: 12 }} width={48} />
              <Tooltip formatter={(value: unknown) => money(Number(value))} {...tooltipStyle} />
              <Line type="monotone" dataKey="total" name="আদায়" stroke="#059669" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="চালানের অবস্থা"
          subtitle="সংখ্যা অনুযায়ী"
          loading={loading}
          empty={!loading && statusPieData.length === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={statusPieData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={3}>
                {statusPieData.map((entry) => (
                  <Cell key={entry.key} fill={STATUS_COLORS[entry.key as keyof typeof STATUS_COLORS]} stroke="none" />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
