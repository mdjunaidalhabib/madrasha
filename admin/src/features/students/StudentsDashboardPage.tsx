import { ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ClipboardCheck, Clock, UserPlus, Users, UsersRound } from "lucide-react";
import { cachedGet } from "../../services/api";
import Card from "@madrasha/shared-ui/src/components/ui/Card";
import ChartCard from "@madrasha/shared-ui/src/components/ui/ChartCard";
import { useThemeStore } from "@madrasha/shared-ui/src/store/themeStore";

type ByClassRow = { classId: number | null; className: string; count: number };
type StudentsDashboardData = {
  totalActiveStudents: number;
  byGender: { male: number; female: number; unspecified: number };
  byClass: ByClassRow[];
  byAdmissionStatus: { pending: number; approved: number; rejected: number };
  admissionTrend: { period: string; count: number }[];
  pendingAdmissionsCount: number;
};

const CLASS_COLORS = ["#4f46e5", "#059669", "#d97706", "#e11d48", "#0ea5e9", "#7c3aed", "#0d9488", "#ca8a04"];
const STATUS_COLORS = { approved: "#059669", pending: "#d97706", rejected: "#e11d48" };

const STAT_TONES = {
  indigo: {
    border: "border-indigo-100 dark:border-indigo-900/40",
    bg: "from-indigo-50 dark:from-indigo-950/30",
    blob: "bg-indigo-400/20",
    icon: "from-indigo-500 to-blue-500 shadow-indigo-500/30",
    glow: "hover:shadow-indigo-900/10",
  },
  sky: {
    border: "border-sky-100 dark:border-sky-900/40",
    bg: "from-sky-50 dark:from-sky-950/30",
    blob: "bg-sky-400/20",
    icon: "from-sky-500 to-cyan-500 shadow-sky-500/30",
    glow: "hover:shadow-sky-900/10",
  },
  rose: {
    border: "border-rose-100 dark:border-rose-900/40",
    bg: "from-rose-50 dark:from-rose-950/30",
    blob: "bg-rose-400/20",
    icon: "from-rose-500 to-pink-500 shadow-rose-500/30",
    glow: "hover:shadow-rose-900/10",
  },
  amber: {
    border: "border-amber-100 dark:border-amber-900/40",
    bg: "from-amber-50 dark:from-amber-950/30",
    blob: "bg-amber-400/20",
    icon: "from-amber-500 to-yellow-500 shadow-amber-500/30",
    glow: "hover:shadow-amber-900/10",
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

export default function StudentsDashboardPage() {
  const [data, setData] = useState<StudentsDashboardData | null>(null);
  const isDark = useThemeStore((s) => s.theme) === "dark";
  const gridColor = isDark ? "#334155" : "#e2e8f0";
  const axisColor = isDark ? "#64748b" : "#94a3b8";

  useEffect(() => {
    (async () => {
      const res = await cachedGet<{ success: boolean; data: StudentsDashboardData }>(
        "/students/dashboard-summary",
      );
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

  const byClass = (data?.byClass || []).slice(0, 8);
  const statusPieData = data
    ? [
        { name: "অনুমোদিত", value: data.byAdmissionStatus.approved, key: "approved" },
        { name: "পেন্ডিং", value: data.byAdmissionStatus.pending, key: "pending" },
        { name: "বাতিল", value: data.byAdmissionStatus.rejected, key: "rejected" },
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
                label="মোট সক্রিয় শিক্ষার্থী"
                value={bn(data.totalActiveStudents)}
                tone="indigo"
                icon={<Users size={20} />}
                to="/students"
              />
              <PremiumStat
                label="ছাত্র"
                value={bn(data.byGender.male)}
                tone="sky"
                icon={<UsersRound size={20} />}
              />
              <PremiumStat
                label="ছাত্রী"
                value={bn(data.byGender.female)}
                tone="rose"
                icon={<UsersRound size={20} />}
              />
              <PremiumStat
                label="পেন্ডিং ভর্তি"
                value={bn(data.pendingAdmissionsCount)}
                tone="amber"
                icon={<Clock size={20} />}
                to="/students/admissions/pending"
              />
            </>
          )}
        </div>

        <Card className="flex h-full flex-col justify-center gap-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            দ্রুত অ্যাকশন
          </p>
          <Link
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-indigo-500"
            to="/students/new"
          >
            <UserPlus size={16} /> নতুন ভর্তি
          </Link>
          <Link
            className="flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-amber-500"
            to="/students/admissions/pending"
          >
            <ClipboardCheck size={16} /> পেন্ডিং ভর্তি অনুমোদন
          </Link>
          {data && data.byAdmissionStatus.rejected > 0 && (
            <Link
              className="flex items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-rose-600"
              to="/students/admissions/rejected"
            >
              <ClipboardCheck size={16} /> বাতিল হওয়া আবেদন
            </Link>
          )}
          <Link
            className="rounded-xl bg-sky-700 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-500"
            to="/students"
          >
            শিক্ষার্থী সমূহ
          </Link>
          <Link
            className="rounded-xl bg-teal-700 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-teal-600"
            to="/students/promotion"
          >
            শিক্ষার্থী প্রমোশন
          </Link>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <ChartCard
          title="ভর্তির প্রবণতা"
          subtitle="গত ১২ মাস"
          loading={loading}
          empty={!loading && !data?.admissionTrend?.length}
          className="xl:col-span-2"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data?.admissionTrend || []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="period" stroke={axisColor} tick={{ fontSize: 12 }} />
              <YAxis stroke={axisColor} tick={{ fontSize: 12 }} width={36} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Line type="monotone" dataKey="count" name="ভর্তি" stroke="#4f46e5" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="ভর্তির অবস্থা"
          subtitle="সর্বমোট আবেদন"
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

      <ChartCard
        title="শ্রেণি অনুযায়ী শিক্ষার্থী"
        subtitle="সক্রিয় ও অনুমোদিত শিক্ষার্থী সংখ্যা"
        loading={loading}
        empty={!loading && byClass.length === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={byClass} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
            <XAxis type="number" stroke={axisColor} tick={{ fontSize: 12 }} allowDecimals={false} />
            <YAxis type="category" dataKey="className" stroke={axisColor} tick={{ fontSize: 12 }} width={110} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="count" name="শিক্ষার্থী" radius={[0, 6, 6, 0]}>
              {byClass.map((entry, index) => (
                <Cell key={entry.classId ?? entry.className} fill={CLASS_COLORS[index % CLASS_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
