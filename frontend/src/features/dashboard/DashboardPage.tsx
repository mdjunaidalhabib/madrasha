import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cachedGet } from "../../services/api";
import PageHeader from "../../components/ui/PageHeader";
import StatTile from "../../components/ui/StatTile";
import Card, { CardHeader } from "../../components/ui/Card";
import ChartCard from "../../components/ui/ChartCard";
import { useThemeStore } from "../../store/themeStore";
import { getTenantAdminBase } from "../../utils/tenantSlug";

const money = (value: number | string) => `৳ ${Number(value || 0).toLocaleString("bn-BD")}`;

type IncomeExpensePoint = { period: string; total_income: number; total_expense: number };
type AttendancePoint = { period: string; percentage: number };
type DashboardTrends = { incomeExpense: IncomeExpensePoint[]; attendance: AttendancePoint[] };

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [trends, setTrends] = useState<DashboardTrends | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(true);
  const { madrasaSlug = "" } = useParams();
  const adminBase = getTenantAdminBase(madrasaSlug);
  const isDark = useThemeStore((s) => s.theme) === "dark";
  const gridColor = isDark ? "#334155" : "#e2e8f0";
  const axisColor = isDark ? "#64748b" : "#94a3b8";

  useEffect(() => {
    (async () => {
      const res = await cachedGet("/dashboard");
      setData(res.data);
    })();
    (async () => {
      try {
        const res = await cachedGet<DashboardTrends>("/dashboard/trends?groupBy=monthly");
        setTrends(res.data);
      } finally {
        setTrendsLoading(false);
      }
    })();
  }, []);

  const loading = !data;

  const cards = loading
    ? []
    : [
        { label: "মোট ছাত্র", value: data.students, tone: "blue" as const },
        { label: "মোট শিক্ষক", value: data.teachers, tone: "indigo" as const },
        { label: "মোট আয়", value: data.income, tone: "emerald" as const, variant: "currency" as const },
        { label: "মোট ব্যয়", value: data.expense, tone: "rose" as const, variant: "currency" as const },
        {
          label: "বর্তমান ব্যালেন্স",
          value: data.balance,
          tone: "slate" as const,
          variant: "currency" as const,
        },
        {
          label: "আজকের আয়/ব্যয়",
          value: data.todayIncome,
          tone: "amber" as const,
          variant: "currency" as const,
          subLabel: `ব্যয়: ${money(data.todayExpense)}`,
        },
      ];

  return (
    <div className="space-y-6">
      <PageHeader title="ড্যাশবোর্ড" subtitle="মাদরাসার এক নজরের সারাংশ" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <StatTile key={i} label="" value="" loading />)
          : cards.map((card) => <StatTile key={card.label} {...card} />)}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatTile key={i} label="" value="" loading />)
        ) : (
          <>
            <StatTile
              label="আজকের হাজিরা %"
              value={data.attendanceToday.percentage}
              variant="percentage"
              tone="emerald"
              subLabel={`${data.attendanceToday.total} জনের হাজিরা নেওয়া হয়েছে`}
              to={`${adminBase}/attendance/mark`}
            />
            <StatTile
              label="অনুমোদনের অপেক্ষায় ভর্তি"
              value={data.pendingAdmissionsCount}
              tone="amber"
              to={`${adminBase}/students/admissions/pending`}
            />
            <StatTile
              label="বকেয়া ফি"
              value={data.overdueFees.totalDue}
              variant="currency"
              tone="rose"
              subLabel={`${data.overdueFees.count} টি ইনভয়েস`}
              to={`${adminBase}/fee-management`}
            />
            <StatTile
              label="আসন্ন পরীক্ষা"
              value={data.upcomingExams.length}
              tone="indigo"
              to={`${adminBase}/routine`}
            />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="আয় ও ব্যয়ের প্রবণতা"
          subtitle="গত ১২ মাস"
          loading={trendsLoading}
          empty={!trendsLoading && !trends?.incomeExpense?.length}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trends?.incomeExpense || []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
              <Line type="monotone" dataKey="total_income" name="আয়" stroke="#10b981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="total_expense" name="ব্যয়" stroke="#f43f5e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="উপস্থিতির হার"
          subtitle="ছাত্রদের মাসিক গড় উপস্থিতি"
          loading={trendsLoading}
          empty={!trendsLoading && !trends?.attendance?.length}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trends?.attendance || []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
              <Bar dataKey="percentage" name="উপস্থিতি %" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="ফান্ড ব্যালেন্স"
            actions={
              <Link
                className="text-sm font-medium text-indigo-600 dark:text-indigo-400"
                to={`${adminBase}/accounts/report`}
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
                <span className="font-bold text-slate-900 dark:text-slate-100">{money(fund.balance)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="দ্রুত কাজ" />
          <div className="grid gap-3">
            <Link
              className="rounded-xl bg-indigo-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-indigo-500"
              to={`${adminBase}/accounts/income`}
            >
              আয় এন্ট্রি
            </Link>
            <Link
              className="rounded-xl bg-rose-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-rose-500"
              to={`${adminBase}/accounts/expense`}
            >
              ব্যয় এন্ট্রি
            </Link>
            <Link
              className="rounded-xl bg-slate-800 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
              to={`${adminBase}/students/new_admission`}
            >
              নতুন ভর্তি
            </Link>
          </div>
        </Card>
      </div>

      <Card padding="none" className="overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">আসন্ন পরীক্ষা</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3">তারিখ</th>
                <th className="px-5 py-3">পরীক্ষা</th>
                <th className="px-5 py-3">শ্রেণি</th>
                <th className="px-5 py-3">বিষয়</th>
                <th className="px-5 py-3">সময়</th>
              </tr>
            </thead>
            <tbody>
              {(data?.upcomingExams || []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-slate-400 dark:text-slate-500">
                    আসন্ন কোনো পরীক্ষা নেই
                  </td>
                </tr>
              )}
              {(data?.upcomingExams || []).map((exam: any) => (
                <tr key={exam.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-5 py-3 dark:text-slate-300">
                    {new Date(exam.examDate).toLocaleDateString("bn-BD")}
                  </td>
                  <td className="px-5 py-3 dark:text-slate-300">{exam.examName}</td>
                  <td className="px-5 py-3 dark:text-slate-300">{exam.className}</td>
                  <td className="px-5 py-3 dark:text-slate-300">{exam.subject}</td>
                  <td className="px-5 py-3 dark:text-slate-300">
                    {exam.startTime} - {exam.endTime}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card padding="none" className="overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">সাম্প্রতিক হিসাব</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3">তারিখ</th>
                <th className="px-5 py-3">ধরন</th>
                <th className="px-5 py-3">ফান্ড</th>
                <th className="px-5 py-3">খাত</th>
                <th className="px-5 py-3">পরিমাণ</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recentTransactions || []).map((item: any) => (
                <tr key={item.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-5 py-3 dark:text-slate-300">{item.entry_date}</td>
                  <td className="px-5 py-3 dark:text-slate-300">{item.type === "income" ? "আয়" : "ব্যয়"}</td>
                  <td className="px-5 py-3 dark:text-slate-300">{item.fund}</td>
                  <td className="px-5 py-3 dark:text-slate-300">{item.category}</td>
                  <td className="px-5 py-3 font-semibold dark:text-slate-100">{money(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
