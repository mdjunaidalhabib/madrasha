import { ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, BookMarked, BookOpen, Library } from "lucide-react";
import { cachedGet } from "../../services/api";
import Card from "@madrasha/shared-ui/src/components/ui/Card";
import ChartCard from "@madrasha/shared-ui/src/components/ui/ChartCard";
import { useThemeStore } from "@madrasha/shared-ui/src/store/themeStore";
import { money } from "../accounts/accountHelpers";

type LibraryDashboardData = {
  totalBooks: number;
  totalCopies: number;
  availableCopies: number;
  onLoan: number;
  statusBreakdown: { borrowed: number; returned: number; lost: number };
  overdueCount: number;
  unsettledFines: { count: number; amount: number };
  byCategory: { category: string; count: number }[];
  borrowTrend: { period: string; count: number }[];
};

const CATEGORY_COLORS = ["#4f46e5", "#059669", "#d97706", "#e11d48", "#0ea5e9", "#7c3aed", "#0d9488", "#ca8a04"];
const STATUS_COLORS = { borrowed: "#d97706", returned: "#059669", lost: "#e11d48" };

const STAT_TONES = {
  indigo: {
    border: "border-indigo-100 dark:border-indigo-900/40",
    bg: "from-indigo-50 dark:from-indigo-950/30",
    blob: "bg-indigo-400/20",
    icon: "from-indigo-500 to-blue-500 shadow-indigo-500/30",
    glow: "hover:shadow-indigo-900/10",
  },
  emerald: {
    border: "border-emerald-100 dark:border-emerald-900/40",
    bg: "from-emerald-50 dark:from-emerald-950/30",
    blob: "bg-emerald-400/20",
    icon: "from-emerald-500 to-teal-500 shadow-emerald-500/30",
    glow: "hover:shadow-emerald-900/10",
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

const bn = (value: number) => Number(value || 0).toLocaleString("bn-BD");

export default function LibraryDashboardPage() {
  const [data, setData] = useState<LibraryDashboardData | null>(null);
  const isDark = useThemeStore((s) => s.theme) === "dark";
  const gridColor = isDark ? "#334155" : "#e2e8f0";
  const axisColor = isDark ? "#64748b" : "#94a3b8";

  useEffect(() => {
    (async () => {
      const res = await cachedGet<{ success: boolean; data: LibraryDashboardData }>("/library/dashboard-summary");
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

  const byCategory = (data?.byCategory || []).slice(0, 8);
  const statusPieData = data
    ? [
        { name: "ইস্যুকৃত", value: data.statusBreakdown.borrowed, key: "borrowed" },
        { name: "ফেরতকৃত", value: data.statusBreakdown.returned, key: "returned" },
        { name: "হারানো", value: data.statusBreakdown.lost, key: "lost" },
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
              <PremiumStat
                label="মোট বই"
                value={bn(data.totalBooks)}
                subLabel={`মোট কপি: ${bn(data.totalCopies)}`}
                tone="indigo"
                icon={<Library size={20} />}
                to="/library/catalog"
              />
              <PremiumStat
                label="বর্তমানে ইস্যুকৃত"
                value={bn(data.onLoan)}
                subLabel={`উপলব্ধ: ${bn(data.availableCopies)}`}
                tone="emerald"
                icon={<BookOpen size={20} />}
                to="/library/circulation"
              />
              <PremiumStat
                label="ওভারডিউ"
                value={bn(data.overdueCount)}
                tone="amber"
                icon={<BookMarked size={20} />}
                to="/library/overdue"
              />
              <PremiumStat
                label="বকেয়া জরিমানা"
                value={money(data.unsettledFines.amount)}
                subLabel={`${bn(data.unsettledFines.count)} টি রেকর্ড`}
                tone="rose"
                icon={<AlertTriangle size={20} />}
                to="/library/overdue"
              />
            </>
          )}
        </div>

        <Card className="flex h-full flex-col justify-center gap-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            দ্রুত অ্যাকশন
          </p>
          <Link
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-indigo-500"
            to="/library/catalog"
          >
            ক্যাটালগ
          </Link>
          <Link
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-emerald-500"
            to="/library/circulation"
          >
            সার্কুলেশন
          </Link>
          <Link
            className="rounded-xl bg-rose-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-rose-500"
            to="/library/overdue"
          >
            ওভারডিউ ও জরিমানা
          </Link>
          <Link
            className="rounded-xl bg-slate-800 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
            to="/library/settings"
          >
            সেটিং
          </Link>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <ChartCard
          title="সার্কুলেশন প্রবণতা"
          subtitle="গত ১২ মাস"
          loading={loading}
          empty={!loading && !data?.borrowTrend?.length}
          className="xl:col-span-2"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data?.borrowTrend || []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="period" stroke={axisColor} tick={{ fontSize: 12 }} />
              <YAxis stroke={axisColor} tick={{ fontSize: 12 }} width={36} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Line type="monotone" dataKey="count" name="ইস্যু" stroke="#4f46e5" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="বই ধারের অবস্থা" loading={loading} empty={!loading && statusPieData.length === 0}>
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

      <ChartCard title="ক্যাটাগরি অনুযায়ী বই" loading={loading} empty={!loading && byCategory.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={byCategory} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
            <XAxis type="number" stroke={axisColor} tick={{ fontSize: 12 }} allowDecimals={false} />
            <YAxis type="category" dataKey="category" stroke={axisColor} tick={{ fontSize: 12 }} width={110} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="count" name="বই" radius={[0, 6, 6, 0]}>
              {byCategory.map((entry, index) => (
                <Cell key={entry.category} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
