import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  GraduationCap,
  Hourglass,
  Link2,
  ReceiptText,
  Scale,
  TrendingDown,
  TrendingUp,
  User,
  UserPlus,
  UserRound,
  Users,
  Wallet,
  Wifi,
} from "lucide-react";
import { cachedGet } from "../../services/api";
import StatTile from "@madrasha/shared-ui/src/components/ui/StatTile";
import Card, { CardHeader } from "@madrasha/shared-ui/src/components/ui/Card";
import ChartCard from "@madrasha/shared-ui/src/components/ui/ChartCard";
import { useThemeStore } from "@madrasha/shared-ui/src/store/themeStore";
import { useAuthStore } from "../../store/authStore";
import { getPublicSiteUrl } from "../../utils/publicSiteUrl";
import VendorPromoCard from "../vendor/VendorPromoCard";

const money = (value: number | string) => `৳ ${Number(value || 0).toLocaleString("bn-BD")}`;

type IncomeExpensePoint = { period: string; total_income: number; total_expense: number };
type AttendancePoint = { period: string; percentage: number };
type DashboardTrends = { incomeExpense: IncomeExpensePoint[]; attendance: AttendancePoint[] };

const FUND_COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#f43f5e",
  "#0ea5e9",
  "#8b5cf6",
  "#14b8a6",
  "#eab308",
];
const GENDER_COLORS = ["#3b82f6", "#f43f5e"];
const CHANNEL_COLORS = ["#0ea5e9", "#f59e0b"];

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [trends, setTrends] = useState<DashboardTrends | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(true);
  const madrasaSlug = useAuthStore((s) => s.madrasaSlug) || "";
  const publicUrl = getPublicSiteUrl(madrasaSlug);
  const isDark = useThemeStore((s) => s.theme) === "dark";
  const gridColor = isDark ? "#334155" : "#e2e8f0";
  const axisColor = isDark ? "#64748b" : "#94a3b8";

  // ttlMs: 0 bypasses the shared GET cache entirely for this call. বকেয়া ফি
  // (overdueFees) and every other summary number here come from this one
  // payload, so caching it - even briefly - meant collecting a payment
  // elsewhere and coming straight back to the dashboard could still show
  // pre-payment numbers for up to GET_CACHE_TTL_MS. The dashboard is only
  // loaded once per visit anyway, so there's no real de-dup benefit worth
  // trading for that staleness.
  const loadDashboard = useCallback(async () => {
    const res = await cachedGet("/dashboard", undefined, 0);
    setData(res.data);
  }, []);

  useEffect(() => {
    loadDashboard();
    (async () => {
      try {
        const res = await cachedGet<DashboardTrends>("/dashboard/trends?groupBy=monthly");
        setTrends(res.data);
      } finally {
        setTrendsLoading(false);
      }
    })();

    // Also refresh when the user comes back to this tab - covers the case
    // where the dashboard was left open in the background while a payment
    // was collected on another tab/page and the component never remounted.
    const onFocus = () => loadDashboard();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadDashboard]);

  const loading = !data;

  const upcomingExams = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return (data?.upcomingExams || [])
      .filter((exam: any) => new Date(exam.examDate) >= today)
      .sort((a: any, b: any) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime());
  }, [data?.upcomingExams]);

  const getChannelTotal = (method: "online" | "offline") => {
    const row = (data?.paymentMethodTotals || []).find((r: any) => r.payment_method === method);
    return { income: Number(row?.income || 0), expense: Number(row?.expense || 0) };
  };
  const onlineTotal = getChannelTotal("online");
  const offlineTotal = getChannelTotal("offline");
  const totalMethodIncome = onlineTotal.income + offlineTotal.income;
  const onlineIncomePct = totalMethodIncome
    ? Math.round((onlineTotal.income / totalMethodIncome) * 100)
    : 0;
  const offlineIncomePct = totalMethodIncome ? 100 - onlineIncomePct : 0;

  const cards = loading
    ? []
    : [
        {
          label: "মোট ছাত্র",
          value: data.students,
          tone: "blue" as const,
          icon: <Users className="h-5 w-5" strokeWidth={1.75} />,
        },
        {
          label: "ছাত্র (ছেলে)",
          value: data.studentsByGender?.male ?? 0,
          tone: "blue" as const,
          icon: <User className="h-5 w-5" strokeWidth={1.75} />,
        },
        {
          label: "ছাত্রী (মেয়ে)",
          value: data.studentsByGender?.female ?? 0,
          tone: "rose" as const,
          icon: <UserRound className="h-5 w-5" strokeWidth={1.75} />,
        },
        {
          label: "মোট শিক্ষক",
          value: data.teachers,
          tone: "indigo" as const,
          icon: <GraduationCap className="h-5 w-5" strokeWidth={1.75} />,
        },
        {
          label: "মোট আয়",
          value: data.income,
          tone: "emerald" as const,
          variant: "currency" as const,
          icon: <TrendingUp className="h-5 w-5" strokeWidth={1.75} />,
        },
        {
          label: "মোট ব্যয়",
          value: data.expense,
          tone: "rose" as const,
          variant: "currency" as const,
          icon: <TrendingDown className="h-5 w-5" strokeWidth={1.75} />,
        },
        {
          label: "বর্তমান ব্যালেন্স",
          value: data.balance,
          tone: "slate" as const,
          variant: "currency" as const,
          icon: <Scale className="h-5 w-5" strokeWidth={1.75} />,
        },
        {
          label: "আজকের আয়/ব্যয়",
          value: data.todayIncome,
          tone: "amber" as const,
          variant: "currency" as const,
          subLabel: `ব্যয়: ${money(data.todayExpense)}`,
          icon: <CalendarClock className="h-5 w-5" strokeWidth={1.75} />,
        },
        {
          label: "অনলাইন আয়",
          value: onlineTotal.income,
          tone: "blue" as const,
          variant: "currency" as const,
          subLabel: `মোট আয়ের ${onlineIncomePct}%`,
          icon: <Wifi className="h-5 w-5" strokeWidth={1.75} />,
        },
        {
          label: "অফলাইন আয় (নগদ)",
          value: offlineTotal.income,
          tone: "amber" as const,
          variant: "currency" as const,
          subLabel: `মোট আয়ের ${offlineIncomePct}%`,
          icon: <Banknote className="h-5 w-5" strokeWidth={1.75} />,
        },
      ];

  const fundData = (data?.fundBalances || [])
    .map((fund: any) => ({
      fund: fund.fund || "নির্ধারিত নয়",
      balance: Number(fund.balance) || 0,
    }))
    .filter((fund: any) => fund.balance > 0);

  const genderData = data
    ? [
        { name: "ছেলে", value: data.studentsByGender?.male ?? 0 },
        { name: "মেয়ে", value: data.studentsByGender?.female ?? 0 },
      ].filter((g) => g.value > 0)
    : [];

  const channelData = data
    ? [
        { channel: "অনলাইন", income: onlineTotal.income, expense: onlineTotal.expense },
        { channel: "অফলাইন", income: offlineTotal.income, expense: offlineTotal.expense },
      ]
    : [];

  const channelShareData = channelData
    .map((c) => ({ name: c.channel, value: c.income + c.expense }))
    .filter((c) => c.value > 0);

  return (
    <div className="space-y-6">
      <div className="grid items-start gap-6 xl:grid-cols-4">
        <div className="min-w-0 space-y-6 xl:col-span-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {loading
              ? Array.from({ length: 10 }).map((_, i) => (
                  <StatTile key={i} label="" value="" loading size="sm" />
                ))
              : cards.map((card) => <StatTile key={card.label} {...card} size="sm" />)}
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <StatTile key={i} label="" value="" loading size="sm" />
              ))
            ) : (
              <>
                <StatTile
                  label="আজকের হাজিরা %"
                  value={data.attendanceToday.percentage}
                  variant="percentage"
                  tone="emerald"
                  subLabel={`${data.attendanceToday.total} জনের হাজিরা নেওয়া হয়েছে`}
                  to={`/attendance/mark`}
                  size="sm"
                  icon={<CheckCircle2 className="h-5 w-5" strokeWidth={1.75} />}
                />
                <StatTile
                  label="অনুমোদনের অপেক্ষায় ভর্তি"
                  value={data.pendingAdmissionsCount}
                  tone="amber"
                  to={`/students/admissions/pending`}
                  size="sm"
                  icon={<Hourglass className="h-5 w-5" strokeWidth={1.75} />}
                />
                <StatTile
                  label="বকেয়া ফি"
                  value={data.overdueFees.totalDue}
                  variant="currency"
                  tone="rose"
                  subLabel={`${data.overdueFees.studentCount} জন শিক্ষার্থীর বকেয়া`}
                  to={`/fee/overdue-fee`}
                  size="sm"
                  icon={<AlertTriangle className="h-5 w-5" strokeWidth={1.75} />}
                />
                <StatTile
                  label="আসন্ন পরীক্ষা"
                  value={data.upcomingExams.length}
                  tone="indigo"
                  to={`/routine`}
                  size="sm"
                  icon={<CalendarDays className="h-5 w-5" strokeWidth={1.75} />}
                />
              </>
            )}
          </div>

          <Card>
            <CardHeader title="আসন্ন পরীক্ষা" subtitle="রুটিন অনুযায়ী আসন্ন পরীক্ষাসমূহ" />
            {!loading && upcomingExams.length === 0 && (
              <p className="py-2 text-center text-xs text-slate-400 dark:text-slate-500">
                আসন্ন কোনো পরীক্ষা নেই
              </p>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {upcomingExams.map((exam: any) => (
                <div
                  key={exam.id}
                  className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-sm dark:bg-slate-800"
                >
                  <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                    পরীক্ষা
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-700 dark:text-slate-300">
                    {exam.examName}
                    {exam.className ? ` · ${exam.className}` : ""}
                  </span>
                  <span className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
                    {new Date(exam.examDate).toLocaleDateString("bn-BD")}
                    {exam.startTime && exam.endTime ? ` · ${exam.startTime}-${exam.endTime}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard
              title="আয় ও ব্যয়ের প্রবণতা"
              subtitle="গত ১২ মাস"
              loading={trendsLoading}
              empty={!trendsLoading && !trends?.incomeExpense?.length}
              height="h-48"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={trends?.incomeExpense || []}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="period" stroke={axisColor} tick={{ fontSize: 12 }} />
                  <YAxis stroke={axisColor} tick={{ fontSize: 12 }} width={48} />
                  <Tooltip
                    formatter={(value: unknown) => money(Number(value))}
                    contentStyle={{
                      backgroundColor: isDark ? "#1e293b" : "#ffffff",
                      border: `1px solid ${gridColor}`,
                      borderRadius: 12,
                      fontSize: 13,
                    }}
                    labelStyle={{ color: isDark ? "#e2e8f0" : "#0f172a" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 13 }} />
                  <Line
                    type="monotone"
                    dataKey="total_income"
                    name="আয়"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="total_expense"
                    name="ব্যয়"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="উপস্থিতির হার"
              subtitle="ছাত্রদের মাসিক গড় উপস্থিতি"
              loading={trendsLoading}
              empty={!trendsLoading && !trends?.attendance?.length}
              height="h-48"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={trends?.attendance || []}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="period" stroke={axisColor} tick={{ fontSize: 12 }} />
                  <YAxis stroke={axisColor} tick={{ fontSize: 12 }} width={40} domain={[0, 100]} />
                  <Tooltip
                    formatter={(value: unknown) => `${Number(value)}%`}
                    contentStyle={{
                      backgroundColor: isDark ? "#1e293b" : "#ffffff",
                      border: `1px solid ${gridColor}`,
                      borderRadius: 12,
                      fontSize: 13,
                    }}
                    labelStyle={{ color: isDark ? "#e2e8f0" : "#0f172a" }}
                  />
                  <Bar
                    dataKey="percentage"
                    name="উপস্থিতি %"
                    fill="#6366f1"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <ChartCard
              title="ফান্ডভিত্তিক বণ্টন"
              subtitle="মোট ব্যালেন্সের অনুপাত"
              loading={loading}
              empty={!loading && fundData.length === 0}
              height="h-48"
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={fundData}
                    dataKey="balance"
                    nameKey="fund"
                    innerRadius={48}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {fundData.map((entry: any, index: number) => (
                      <Cell
                        key={entry.fund}
                        fill={FUND_COLORS[index % FUND_COLORS.length]}
                        stroke="none"
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: unknown) => money(Number(value))}
                    contentStyle={{
                      backgroundColor: isDark ? "#1e293b" : "#ffffff",
                      border: `1px solid ${gridColor}`,
                      borderRadius: 12,
                      fontSize: 13,
                    }}
                    labelStyle={{ color: isDark ? "#e2e8f0" : "#0f172a" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <Card>
              <CardHeader
                title="ফান্ড ব্যালেন্স"
                actions={
                  <Link
                    className="text-sm font-medium text-indigo-600 dark:text-indigo-400"
                    to={`/accounts/report`}
                  >
                    রিপোর্ট দেখুন
                  </Link>
                }
              />
              <div className="space-y-3">
                {(data?.fundBalances || []).map((fund: any) => (
                  <div
                    key={fund.fund || "empty"}
                    className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800"
                  >
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {fund.fund || "নির্ধারিত নয়"}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {money(fund.balance)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <ChartCard
              title="ছাত্র-ছাত্রী অনুপাত"
              subtitle="লিঙ্গভিত্তিক বণ্টন"
              loading={loading}
              empty={!loading && genderData.length === 0}
              height="h-48"
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={genderData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {genderData.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={GENDER_COLORS[index % GENDER_COLORS.length]}
                        stroke="none"
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: unknown) => Number(value).toLocaleString("bn-BD")}
                    contentStyle={{
                      backgroundColor: isDark ? "#1e293b" : "#ffffff",
                      border: `1px solid ${gridColor}`,
                      borderRadius: 12,
                      fontSize: 13,
                    }}
                    labelStyle={{ color: isDark ? "#e2e8f0" : "#0f172a" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard
              title="অনলাইন বনাম অফলাইন আয়-ব্যয়"
              subtitle="পেমেন্ট মাধ্যম অনুযায়ী হিসাব"
              loading={loading}
              empty={!loading && channelData.every((c) => c.income === 0 && c.expense === 0)}
              height="h-48"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={channelData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="channel" stroke={axisColor} tick={{ fontSize: 12 }} />
                  <YAxis stroke={axisColor} tick={{ fontSize: 12 }} width={48} />
                  <Tooltip
                    formatter={(value: unknown) => money(Number(value))}
                    contentStyle={{
                      backgroundColor: isDark ? "#1e293b" : "#ffffff",
                      border: `1px solid ${gridColor}`,
                      borderRadius: 12,
                      fontSize: 13,
                    }}
                    labelStyle={{ color: isDark ? "#e2e8f0" : "#0f172a" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 13 }} />
                  <Bar dataKey="income" name="আয়" fill="#10b981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expense" name="ব্যয়" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="লেনদেনের মাধ্যম"
              subtitle="মোট লেনদেনের ভাগ (আয় + ব্যয়)"
              loading={loading}
              empty={!loading && channelShareData.length === 0}
              height="h-48"
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={channelShareData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {channelShareData.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={CHANNEL_COLORS[index % CHANNEL_COLORS.length]}
                        stroke="none"
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: unknown) => money(Number(value))}
                    contentStyle={{
                      backgroundColor: isDark ? "#1e293b" : "#ffffff",
                      border: `1px solid ${gridColor}`,
                      borderRadius: 12,
                      fontSize: 13,
                    }}
                    labelStyle={{ color: isDark ? "#e2e8f0" : "#0f172a" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </div>

        <div className="min-w-0 space-y-6 xl:col-span-1">
          <Card>
            <CardHeader
              title="দ্রুত কাজ"
              subtitle="প্রায়ই ব্যবহৃত কাজ"
              nowrap
              actions={
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-sky-600/20 transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-sky-600/30"
                >
                  <ExternalLink size={13} />
                  ওয়েবসাইট দেখুন
                </a>
              }
            />
            <div className="space-y-2">
              <Link
                className="flex items-center gap-3 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-indigo-500 hover:shadow-md"
                to={`/accounts/income`}
              >
                <Wallet className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                আয় এন্ট্রি
              </Link>
              <Link
                className="flex items-center gap-3 rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-rose-500 hover:shadow-md"
                to={`/accounts/expense`}
              >
                <ReceiptText className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                ব্যয় এন্ট্রি
              </Link>
              <Link
                className="flex items-center gap-3 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-violet-500 hover:shadow-md"
                to={`/students/new_admission`}
              >
                <UserPlus className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                নতুন ভর্তি
              </Link>
            </div>
          </Card>

          <Card>
            <CardHeader title="গুরুত্বপূর্ণ লিংক" subtitle="বোর্ড ও কর্তৃপক্ষ" />
            <div className="space-y-2">
              {(data?.importantLinks || []).length === 0 && !loading && (
                <p className="py-2 text-center text-xs text-slate-400 dark:text-slate-500">
                  কোনো লিংক যোগ করা হয়নি
                </p>
              )}
              {(data?.importantLinks || []).map((link: any) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 transition hover:border-indigo-300 hover:bg-indigo-50/60 dark:border-slate-700 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/30"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                    <Link2 className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {link.label}
                    </span>
                    {link.subLabel && (
                      <span className="block text-xs text-slate-400 dark:text-slate-500">
                        {link.subLabel}
                      </span>
                    )}
                  </span>
                  <ExternalLink
                    className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600"
                    strokeWidth={1.75}
                  />
                </a>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="সাম্প্রতিক লেনদেন"
              actions={
                <Link
                  className="text-sm font-medium text-indigo-600 dark:text-indigo-400"
                  to={`/accounts/transactions`}
                >
                  সব দেখুন
                </Link>
              }
            />
            <div className="space-y-2">
              {!loading && (data?.recentTransactions || []).length === 0 && (
                <p className="py-2 text-center text-xs text-slate-400 dark:text-slate-500">
                  কোনো লেনদেন নেই
                </p>
              )}
              {(data?.recentTransactions || []).slice(0, 5).map((tx: any) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-300">
                      {tx.donorName || tx.receiverName || tx.category || tx.fund}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      {new Date(tx.entryDate).toLocaleDateString("bn-BD")}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-bold ${
                      tx.type === "income"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {tx.type === "income" ? "+" : "-"}
                    {money(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="বকেয়া ফি তালিকা"
              subtitle={!loading ? `মোট ${money(data?.overdueFees?.totalDue || 0)}` : undefined}
              actions={
                <Link
                  className="text-sm font-medium text-indigo-600 dark:text-indigo-400"
                  to={`/fee/overdue-fee`}
                >
                  সব দেখুন
                </Link>
              }
            />
            <div className="space-y-2">
              {!loading && (data?.overdueFees?.list || []).length === 0 && (
                <p className="py-2 text-center text-xs text-slate-400 dark:text-slate-500">
                  কোনো বকেয়া নেই
                </p>
              )}
              {(data?.overdueFees?.list || []).map((item: any) => (
                <Link
                  key={item.studentId}
                  to={`/fee/overdue-fee?student_id=${item.studentId}`}
                  className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-300">
                      {item.studentName}
                    </p>
                    <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">
                      {item.invoiceCount} টি বকেয়া ফি
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-rose-600 dark:text-rose-400">
                    {money(item.remaining)}
                  </span>
                </Link>
              ))}
            </div>
          </Card>

          <VendorPromoCard />
        </div>
      </div>
    </div>
  );
}
