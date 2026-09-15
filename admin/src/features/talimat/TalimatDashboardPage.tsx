import { ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Award, BookOpen, CheckCircle2, ClipboardEdit, GraduationCap, XCircle } from "lucide-react";
import { cachedGet } from "../../services/api";
import Card, { CardHeader } from "@madrasha/shared-ui/src/components/ui/Card";
import ChartCard from "@madrasha/shared-ui/src/components/ui/ChartCard";
import Badge, { BadgeTone } from "@madrasha/shared-ui/src/components/ui/Badge";
import { useThemeStore } from "@madrasha/shared-ui/src/store/themeStore";

type ExamStatus = "upcoming" | "ongoing" | "completed" | "no_routine";

type ExamStatusRow = {
  examId: number;
  name: string;
  year: string;
  isActive: boolean;
  status: ExamStatus;
  startDate: string | null;
  endDate: string | null;
};

type TalimatDashboardData = {
  latestExam: { id: number; name: string; year: number } | null;
  totalExams: number;
  activeExamsCount: number;
  published: number;
  draft: number;
  examStatusBreakdown: { upcoming: number; ongoing: number; completed: number };
  examStatusRows: ExamStatusRow[];
  statusBreakdown: { pass: number; fail: number; absent: number };
  averageMarks: number;
  studentsGraded: number;
  gradeDistribution: { grade: string; count: number }[];
  classStatus: {
    class_id: number;
    division_id: number;
    exam_id: number;
    total_students: number;
    entered_students: number;
  }[];
};

type OverviewData = {
  classes: { class_id: number; class_name_bn: string; division_id: number }[];
};

const STATUS_COLORS = { pass: "#059669", fail: "#e11d48", absent: "#94a3b8" };
const GRADE_COLORS = ["#4f46e5", "#059669", "#d97706", "#e11d48", "#0ea5e9", "#7c3aed", "#0d9488", "#ca8a04"];

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
} as const;

type StatTone = keyof typeof STAT_TONES;

const EXAM_STATUS_META: Record<ExamStatus, { label: string; tone: BadgeTone }> = {
  upcoming: { label: "আসন্ন", tone: "blue" },
  ongoing: { label: "চলমান", tone: "green" },
  completed: { label: "সমাপ্ত", tone: "slate" },
  no_routine: { label: "রুটিন নেই", tone: "yellow" },
};

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

export default function TalimatDashboardPage() {
  const [data, setData] = useState<TalimatDashboardData | null>(null);
  const [classNameById, setClassNameById] = useState<Map<number, string>>(new Map());
  const isDark = useThemeStore((s) => s.theme) === "dark";
  const gridColor = isDark ? "#334155" : "#e2e8f0";
  const axisColor = isDark ? "#64748b" : "#94a3b8";

  useEffect(() => {
    (async () => {
      const [summaryRes, overviewRes] = await Promise.all([
        cachedGet<{ success: boolean; data: TalimatDashboardData }>("/results/dashboard-summary"),
        cachedGet<OverviewData>("/results/overview"),
      ]);
      setData((summaryRes.data as any)?.data ?? null);
      const classes = (overviewRes.data as any)?.classes || [];
      setClassNameById(new Map(classes.map((c: any) => [c.class_id, c.class_name_bn])));
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
        { name: "পাস", value: data.statusBreakdown.pass, key: "pass" },
        { name: "ফেল", value: data.statusBreakdown.fail, key: "fail" },
        { name: "অনুপস্থিত", value: data.statusBreakdown.absent, key: "absent" },
      ].filter((row) => row.value > 0)
    : [];

  const gradeChartData = (data?.gradeDistribution || []).map((row) => ({ grade: row.grade || "N/A", count: row.count }));

  const classStatusRows = (data?.classStatus || [])
    .map((row) => ({ ...row, className: classNameById.get(row.class_id) || `ক্লাস #${row.class_id}` }))
    .sort((a, b) => a.className.localeCompare(b.className, "bn"));

  const examStatusRows = data?.examStatusRows || [];
  const formatDate = (value: string | null) =>
    value ? new Date(value).toLocaleDateString("bn-BD", { day: "numeric", month: "short", year: "numeric" }) : "-";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:col-span-4 xl:grid-cols-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <PremiumStatSkeleton key={i} />)
          ) : (
            <>
              <PremiumStat
                label="সর্বশেষ পরীক্ষা"
                value={data.latestExam ? data.latestExam.name : "নেই"}
                subLabel={data.latestExam ? `শিক্ষাবর্ষ ${bn(data.latestExam.year)}` : undefined}
                tone="indigo"
                icon={<GraduationCap size={20} />}
              />
              <PremiumStat label="গড় নম্বর" value={bn(data.averageMarks)} subLabel={`${bn(data.studentsGraded)} জন মূল্যায়িত`} tone="amber" icon={<Award size={20} />} />
              <PremiumStat label="পাস" value={bn(data.statusBreakdown.pass)} tone="emerald" icon={<CheckCircle2 size={20} />} />
              <PremiumStat label="ফেল" value={bn(data.statusBreakdown.fail)} tone="rose" icon={<XCircle size={20} />} />
            </>
          )}
        </div>

        <Card className="flex flex-col justify-center gap-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            দ্রুত অ্যাকশন
          </p>
          <Link
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-indigo-500"
            to="/talimat/results/entry"
          >
            <ClipboardEdit size={16} /> নম্বর এন্ট্রি
          </Link>
          <Link
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-emerald-500"
            to="/talimat/results"
          >
            ফলাফল প্রিভিউ
          </Link>
          <Link
            className="flex items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-500"
            to="/talimat/settings"
          >
            <BookOpen size={16} /> সেটিং
          </Link>
        </Card>
      </div>

      <Card>
        <CardHeader title="পরীক্ষা ও প্রকাশনার অবস্থা" />
        <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          <div>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{loading ? "-" : bn(data.totalExams)}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">মোট পরীক্ষা</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{loading ? "-" : bn(data.activeExamsCount)}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">সক্রিয় পরীক্ষা</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{loading ? "-" : bn(data.published)}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">প্রকাশিত</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{loading ? "-" : bn(data.draft)}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">খসড়া</p>
          </div>
        </div>
      </Card>

      <Card padding="none" className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">পরীক্ষার অবস্থা</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">রুটিন অনুযায়ী প্রতিটি পরীক্ষা আসন্ন, চলমান নাকি সমাপ্ত</p>
          </div>
          {!loading && data && (
            <div className="flex flex-wrap gap-2">
              <Badge tone="blue">আসন্ন {bn(data.examStatusBreakdown.upcoming)}</Badge>
              <Badge tone="green">চলমান {bn(data.examStatusBreakdown.ongoing)}</Badge>
              <Badge tone="slate">সমাপ্ত {bn(data.examStatusBreakdown.completed)}</Badge>
            </div>
          )}
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {!loading && examStatusRows.length === 0 && (
            <p className="px-5 py-6 text-center text-sm text-slate-400 dark:text-slate-500">কোনো পরীক্ষা পাওয়া যায়নি</p>
          )}
          {examStatusRows.map((row) => {
            const meta = EXAM_STATUS_META[row.status];
            return (
              <div key={row.examId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                    {row.name} <span className="text-slate-400 dark:text-slate-500">({row.year})</span>
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {row.startDate && row.endDate
                      ? row.startDate === row.endDate
                        ? formatDate(row.startDate)
                        : `${formatDate(row.startDate)} - ${formatDate(row.endDate)}`
                      : "পরীক্ষার রুটিন যোগ করা হয়নি"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!row.isActive && <Badge tone="slate">ইনঅ্যাকটিভ</Badge>}
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="ফলাফলের অবস্থা"
          subtitle={data?.latestExam ? `সর্বশেষ পরীক্ষা: ${data.latestExam.name}` : undefined}
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

        <ChartCard
          title="গ্রেড বণ্টন"
          subtitle={data?.latestExam ? `সর্বশেষ পরীক্ষা: ${data.latestExam.name}` : undefined}
          loading={loading}
          empty={!loading && gradeChartData.length === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={gradeChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="grade" stroke={axisColor} tick={{ fontSize: 12 }} />
              <YAxis stroke={axisColor} tick={{ fontSize: 12 }} width={36} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" name="শিক্ষার্থী" radius={[6, 6, 0, 0]}>
                {gradeChartData.map((entry, index) => (
                  <Cell key={entry.grade} fill={GRADE_COLORS[index % GRADE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Card padding="none" className="overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">শ্রেণিভিত্তিক নম্বর এন্ট্রির অবস্থা</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {data?.latestExam ? `সর্বশেষ পরীক্ষা: ${data.latestExam.name}` : "সর্বশেষ পরীক্ষার তথ্য নেই"}
          </p>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {!loading && classStatusRows.length === 0 && (
            <p className="px-5 py-6 text-center text-sm text-slate-400 dark:text-slate-500">কোনো তথ্য পাওয়া যায়নি</p>
          )}
          {classStatusRows.map((row) => {
            const pct = row.total_students > 0 ? Math.round((row.entered_students / row.total_students) * 100) : 0;
            return (
              <div key={row.class_id} className="flex items-center gap-4 px-5 py-3">
                <span className="w-32 shrink-0 truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                  {row.className}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : "bg-amber-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right text-xs text-slate-500 dark:text-slate-400">
                  {bn(row.entered_students)} / {bn(row.total_students)}
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
