import { ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CheckCircle2, Clock, History, MessageSquare, Send, XCircle } from "lucide-react";
import { cachedGet } from "../../services/api";
import Card from "@madrasha/shared-ui/src/components/ui/Card";
import ChartCard from "@madrasha/shared-ui/src/components/ui/ChartCard";
import { useThemeStore } from "@madrasha/shared-ui/src/store/themeStore";

type ChannelStats = { sent: number; failed: number; pending: number };
type CommunicationDashboardData = {
  totalSent: number;
  totalFailed: number;
  totalPending: number;
  byChannel: { SMS: ChannelStats; EMAIL: ChannelStats };
  trend: { period: string; sent: number; failed: number }[];
};

const STAT_TONES = {
  emerald: {
    border: "border-emerald-100 dark:border-emerald-900/40",
    bg: "from-emerald-50 dark:from-emerald-950/30",
    blob: "bg-emerald-400/20",
    icon: "from-emerald-500 to-teal-500 shadow-emerald-500/30",
    glow: "hover:shadow-emerald-900/10",
  },
  rose: {
    border: "border-rose-100 dark:border-rose-900/40",
    bg: "from-rose-50 dark:from-rose-950/30",
    blob: "bg-rose-400/20",
    icon: "from-rose-500 to-orange-500 shadow-rose-500/30",
    glow: "hover:shadow-rose-900/10",
  },
  amber: {
    border: "border-amber-100 dark:border-amber-900/40",
    bg: "from-amber-50 dark:from-amber-950/30",
    blob: "bg-amber-400/20",
    icon: "from-amber-500 to-yellow-500 shadow-amber-500/30",
    glow: "hover:shadow-amber-900/10",
  },
  indigo: {
    border: "border-indigo-100 dark:border-indigo-900/40",
    bg: "from-indigo-50 dark:from-indigo-950/30",
    blob: "bg-indigo-400/20",
    icon: "from-indigo-500 to-blue-500 shadow-indigo-500/30",
    glow: "hover:shadow-indigo-900/10",
  },
} as const;

type StatTone = keyof typeof STAT_TONES;

const PremiumStat = ({
  icon,
  label,
  value,
  subLabel,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  subLabel?: string;
  tone: StatTone;
}) => {
  const t = STAT_TONES[tone];
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border ${t.border} bg-gradient-to-br ${t.bg} via-white to-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${t.glow} dark:via-slate-900 dark:to-slate-900`}
    >
      <div className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full ${t.blob} blur-2xl transition-transform duration-300 group-hover:scale-110`} />
      <span className={`relative inline-flex rounded-2xl bg-gradient-to-br ${t.icon} p-3 text-white shadow-lg`}>{icon}</span>
      <p className="relative mt-4 text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="relative mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{value}</p>
      {subLabel && <p className="relative mt-1 truncate text-xs text-slate-400 dark:text-slate-500">{subLabel}</p>}
    </div>
  );
};

const PremiumStatSkeleton = () => (
  <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm dark:border-slate-700/60 dark:bg-slate-900">
    <div className="h-11 w-11 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-700/70" />
    <div className="mt-4 h-4 w-20 animate-pulse rounded bg-slate-200/70 dark:bg-slate-700/70" />
    <div className="mt-2 h-7 w-28 animate-pulse rounded bg-slate-200/70 dark:bg-slate-700/70" />
  </div>
);

const bn = (value: number) => Number(value || 0).toLocaleString("bn-BD");

export default function CommunicationDashboardPage() {
  const [data, setData] = useState<CommunicationDashboardData | null>(null);
  const isDark = useThemeStore((s) => s.theme) === "dark";
  const gridColor = isDark ? "#334155" : "#e2e8f0";
  const axisColor = isDark ? "#64748b" : "#94a3b8";

  useEffect(() => {
    (async () => {
      const res = await cachedGet<{ success: boolean; data: CommunicationDashboardData }>(
        "/notifications/dashboard-summary",
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

  const channelChartData = data
    ? [
        { label: "SMS", পাঠানো: data.byChannel.SMS.sent, ব্যর্থ: data.byChannel.SMS.failed, পেন্ডিং: data.byChannel.SMS.pending },
        { label: "ইমেইল", পাঠানো: data.byChannel.EMAIL.sent, ব্যর্থ: data.byChannel.EMAIL.failed, পেন্ডিং: data.byChannel.EMAIL.pending },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:col-span-4 xl:grid-cols-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <PremiumStatSkeleton key={i} />)
          ) : (
            <>
              <PremiumStat label="মোট পাঠানো" value={bn(data.totalSent)} tone="emerald" icon={<CheckCircle2 size={20} />} />
              <PremiumStat label="ব্যর্থ" value={bn(data.totalFailed)} tone="rose" icon={<XCircle size={20} />} />
              <PremiumStat label="পেন্ডিং" value={bn(data.totalPending)} tone="amber" icon={<Clock size={20} />} />
              <PremiumStat
                label="SMS পাঠানো"
                value={bn(data.byChannel.SMS.sent)}
                subLabel={`ইমেইল: ${bn(data.byChannel.EMAIL.sent)}`}
                tone="indigo"
                icon={<MessageSquare size={20} />}
              />
            </>
          )}
        </div>

        <Card className="flex flex-col justify-center gap-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            দ্রুত অ্যাকশন
          </p>
          <Link
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-indigo-500"
            to="/communication/single-send"
          >
            <Send size={16} /> একক পাঠান
          </Link>
          <Link
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-emerald-500"
            to="/communication/bulk-send"
          >
            বাল্ক পাঠান
          </Link>
          <Link
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
            to="/communication/history"
          >
            <History size={16} /> পাঠানোর ইতিহাস
          </Link>
          <Link
            className="rounded-xl bg-teal-700 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-teal-600"
            to="/communication/auto-settings"
          >
            অটো নোটিফিকেশন
          </Link>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <ChartCard
          title="পাঠানোর প্রবণতা"
          subtitle="গত ১৪ দিন"
          loading={loading}
          empty={!loading && !data?.trend?.length}
          className="xl:col-span-2"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data?.trend || []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="period" stroke={axisColor} tick={{ fontSize: 11 }} />
              <YAxis stroke={axisColor} tick={{ fontSize: 12 }} width={36} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              <Line type="monotone" dataKey="sent" name="পাঠানো" stroke="#059669" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="failed" name="ব্যর্থ" stroke="#e11d48" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="চ্যানেল অনুযায়ী" subtitle="SMS বনাম ইমেইল" loading={loading} empty={!loading && channelChartData.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={channelChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="label" stroke={axisColor} tick={{ fontSize: 12 }} />
              <YAxis stroke={axisColor} tick={{ fontSize: 12 }} width={36} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="পাঠানো" fill="#059669" radius={[6, 6, 0, 0]} />
              <Bar dataKey="ব্যর্থ" fill="#e11d48" radius={[6, 6, 0, 0]} />
              <Bar dataKey="পেন্ডিং" fill="#d97706" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
