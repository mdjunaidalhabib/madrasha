import { ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { GraduationCap, UserPlus, Users, UsersRound } from "lucide-react";
import { cachedGet } from "../../services/api";
import Card from "@madrasha/shared-ui/src/components/ui/Card";
import ChartCard from "@madrasha/shared-ui/src/components/ui/ChartCard";
import { useThemeStore } from "@madrasha/shared-ui/src/store/themeStore";

type GenderBreakdown = { male: number; female: number; unspecified: number };
type DesignationRow = { designation: string; count: number };
type TrendRow = { period: string; count: number };

type TeacherSummary = {
  totalActiveTeachers: number;
  byGender: GenderBreakdown;
  byDesignation: DesignationRow[];
  joiningTrend: TrendRow[];
};
type StaffSummary = {
  totalActiveStaff: number;
  byGender: GenderBreakdown;
  byDesignation: DesignationRow[];
  joiningTrend: TrendRow[];
};

const DESIGNATION_COLORS = ["#4f46e5", "#059669", "#d97706", "#e11d48", "#0ea5e9", "#7c3aed", "#0d9488", "#ca8a04"];
const GENDER_COLORS = { male: "#0ea5e9", female: "#e11d48", unspecified: "#94a3b8" };

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

/** Merges two {period,count} series (different periods may be missing from
 * either side) into one chart-ready array keyed by the union of periods,
 * sorted ascending. */
const mergeTrends = (a: TrendRow[], b: TrendRow[], aKey: string, bKey: string) => {
  const periods = [...new Set([...a.map((r) => r.period), ...b.map((r) => r.period)])].sort();
  const aByPeriod = new Map(a.map((r) => [r.period, r.count]));
  const bByPeriod = new Map(b.map((r) => [r.period, r.count]));
  return periods.map((period) => ({
    period,
    [aKey]: aByPeriod.get(period) || 0,
    [bKey]: bByPeriod.get(period) || 0,
  }));
};

export default function TeacherStaffDashboardPage() {
  const [teacher, setTeacher] = useState<TeacherSummary | null>(null);
  const [staff, setStaff] = useState<StaffSummary | null>(null);
  const isDark = useThemeStore((s) => s.theme) === "dark";
  const gridColor = isDark ? "#334155" : "#e2e8f0";
  const axisColor = isDark ? "#64748b" : "#94a3b8";

  useEffect(() => {
    (async () => {
      const [teacherRes, staffRes] = await Promise.all([
        cachedGet<{ success: boolean; data: TeacherSummary }>("/teachers/dashboard-summary"),
        cachedGet<{ success: boolean; data: StaffSummary }>("/staff/dashboard-summary"),
      ]);
      setTeacher((teacherRes.data as any)?.data ?? null);
      setStaff((staffRes.data as any)?.data ?? null);
    })();
  }, []);

  const loading = !teacher || !staff;

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: isDark ? "#1e293b" : "#ffffff",
      border: `1px solid ${gridColor}`,
      borderRadius: 12,
      fontSize: 13,
    },
    labelStyle: { color: isDark ? "#e2e8f0" : "#0f172a" },
  };

  const totalMale = (teacher?.byGender.male || 0) + (staff?.byGender.male || 0);
  const totalFemale = (teacher?.byGender.female || 0) + (staff?.byGender.female || 0);

  const joiningTrend = teacher && staff ? mergeTrends(teacher.joiningTrend, staff.joiningTrend, "teacher", "staff") : [];
  const teacherDesignations = (teacher?.byDesignation || []).slice(0, 6);
  const staffDesignations = (staff?.byDesignation || []).slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:col-span-4 xl:grid-cols-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <PremiumStatSkeleton key={i} />)
          ) : (
            <>
              <PremiumStat
                label="মোট শিক্ষক"
                value={bn(teacher.totalActiveTeachers)}
                tone="indigo"
                icon={<GraduationCap size={20} />}
                to="/teacher_staff/all_teacher"
              />
              <PremiumStat
                label="মোট স্টাফ"
                value={bn(staff.totalActiveStaff)}
                tone="emerald"
                icon={<Users size={20} />}
                to="/teacher_staff/all_staff"
              />
              <PremiumStat label="পুরুষ" value={bn(totalMale)} tone="sky" icon={<UsersRound size={20} />} />
              <PremiumStat label="মহিলা" value={bn(totalFemale)} tone="rose" icon={<UsersRound size={20} />} />
            </>
          )}
        </div>

        <Card className="flex h-full flex-col justify-center gap-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            দ্রুত অ্যাকশন
          </p>
          <Link
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-indigo-500"
            to="/teacher_staff/teacher_admission"
          >
            <UserPlus size={16} /> নতুন শিক্ষক
          </Link>
          <Link
            className="rounded-xl bg-sky-700 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-500"
            to="/teacher_staff/all_teacher"
          >
            শিক্ষকসমূহ
          </Link>
          <Link
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-emerald-500"
            to="/teacher_staff/staff_admission"
          >
            <UserPlus size={16} /> নতুন স্টাফ
          </Link>
          <Link
            className="rounded-xl bg-teal-700 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-teal-600"
            to="/teacher_staff/all_staff"
          >
            স্টাফসমূহ
          </Link>
        </Card>
      </div>

      <ChartCard
        title="নিয়োগের প্রবণতা"
        subtitle="গত ১২ মাস, শিক্ষক বনাম স্টাফ"
        loading={loading}
        empty={!loading && joiningTrend.length === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={joiningTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="period" stroke={axisColor} tick={{ fontSize: 12 }} />
            <YAxis stroke={axisColor} tick={{ fontSize: 12 }} width={36} allowDecimals={false} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            <Line type="monotone" dataKey="teacher" name="শিক্ষক" stroke="#4f46e5" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="staff" name="স্টাফ" stroke="#059669" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="শিক্ষক - পদবি অনুযায়ী"
          loading={loading}
          empty={!loading && teacherDesignations.length === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={teacherDesignations} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
              <XAxis type="number" stroke={axisColor} tick={{ fontSize: 12 }} allowDecimals={false} />
              <YAxis type="category" dataKey="designation" stroke={axisColor} tick={{ fontSize: 12 }} width={100} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" name="শিক্ষক" radius={[0, 6, 6, 0]}>
                {teacherDesignations.map((entry, index) => (
                  <Cell key={entry.designation} fill={DESIGNATION_COLORS[index % DESIGNATION_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="স্টাফ - পদবি অনুযায়ী"
          loading={loading}
          empty={!loading && staffDesignations.length === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={staffDesignations} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
              <XAxis type="number" stroke={axisColor} tick={{ fontSize: 12 }} allowDecimals={false} />
              <YAxis type="category" dataKey="designation" stroke={axisColor} tick={{ fontSize: 12 }} width={100} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" name="স্টাফ" radius={[0, 6, 6, 0]}>
                {staffDesignations.map((entry, index) => (
                  <Cell key={entry.designation} fill={DESIGNATION_COLORS[index % DESIGNATION_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {!loading && (
        <ChartCard title="লিঙ্গ অনুযায়ী বণ্টন" subtitle="শিক্ষক ও স্টাফ মিলিয়ে">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[
                  { name: "পুরুষ", value: totalMale, key: "male" },
                  { name: "মহিলা", value: totalFemale, key: "female" },
                ].filter((row) => row.value > 0)}
                dataKey="value"
                nameKey="name"
                innerRadius={48}
                outerRadius={80}
                paddingAngle={3}
              >
                <Cell fill={GENDER_COLORS.male} stroke="none" />
                <Cell fill={GENDER_COLORS.female} stroke="none" />
              </Pie>
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}
