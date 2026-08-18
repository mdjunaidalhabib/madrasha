import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
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
import { cachedGet } from "../../services/api";
import StatTile from "../../components/ui/StatTile";
import Card, { CardHeader } from "../../components/ui/Card";
import ChartCard from "../../components/ui/ChartCard";
import { useThemeStore } from "../../store/themeStore";
import { getTenantAdminBase } from "../../utils/tenantSlug";
import { money } from "./accountHelpers";

type IncomeExpensePoint = { period: string; total_income: number; total_expense: number };
type DashboardTrends = { incomeExpense: IncomeExpensePoint[] };
type FundBalance = { fund: string | null; balance: number | string };
type RecentTransaction = {
  id: number;
  entry_date: string;
  type: "income" | "expense";
  fund: string;
  category: string;
  amount: number | string;
};

const FUND_COLORS = ["#059669", "#d97706", "#4f46e5", "#e11d48", "#0ea5e9", "#7c3aed", "#0d9488", "#ca8a04"];

export default function AccountDashboardPage() {
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
  const today = new Date().toLocaleDateString("bn-BD", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const fundData: { fund: string; balance: number }[] = (data?.fundBalances || [])
    .map((fund: FundBalance) => ({ fund: fund.fund || "নির্ধারিত নয়", balance: Number(fund.balance) || 0 }))
    .filter((fund: { fund: string; balance: number }) => fund.balance > 0);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-700 p-6 text-white shadow-lg shadow-emerald-700/25 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-amber-300/20 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-100/80">হিসাব বিভাগ</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">হিসাব ড্যাশবোর্ড</h1>
          <p className="mt-1 text-sm text-emerald-100 sm:text-base">আয়, ব্যয় ও ফান্ডের সার্বিক চিত্র</p>
          <p className="mt-2 text-xs font-medium text-emerald-100/80">{today}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatTile key={i} label="" value="" loading />)
        ) : (
          <>
            <StatTile label="মোট আয়" value={data.income} tone="emerald" variant="currency" />
            <StatTile label="মোট ব্যয়" value={data.expense} tone="rose" variant="currency" />
            <StatTile label="বর্তমান ব্যালেন্স" value={data.balance} tone="slate" variant="currency" />
            <StatTile
              label="আজকের আয়"
              value={data.todayIncome}
              tone="amber"
              variant="currency"
              subLabel={`আজকের ব্যয়: ${money(data.todayExpense)}`}
            />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <ChartCard
          title="আয়-ব্যয়ের প্রবণতা"
          subtitle="গত ১২ মাস"
          loading={trendsLoading}
          empty={!trendsLoading && !trends?.incomeExpense?.length}
          className="xl:col-span-2"
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
              <Line type="monotone" dataKey="total_income" name="আয়" stroke="#059669" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="total_expense" name="ব্যয়" stroke="#e11d48" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="ফান্ড অনুযায়ী বণ্টন"
          subtitle="বর্তমান ব্যালেন্স"
          loading={loading}
          empty={!loading && fundData.length === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={fundData} dataKey="balance" nameKey="fund" innerRadius={48} outerRadius={80} paddingAngle={3}>
                {fundData.map((entry, index) => (
                  <Cell key={entry.fund} fill={FUND_COLORS[index % FUND_COLORS.length]} stroke="none" />
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

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="ফান্ড ব্যালেন্স" actions={<Link className="text-sm font-medium text-emerald-600 dark:text-emerald-400" to={`${adminBase}/accounts/report`}>রিপোর্ট দেখুন</Link>} />
          <div className="space-y-3">
            {(data?.fundBalances || []).map((fund: FundBalance) => (
              <div key={fund.fund || "empty"} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800">
                <span className="font-medium text-slate-700 dark:text-slate-300">{fund.fund || "নির্ধারিত নয়"}</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{money(fund.balance)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="দ্রুত অ্যাকশন" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              className="rounded-xl bg-emerald-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-emerald-500"
              to={`${adminBase}/accounts/income`}
            >
              আয়/রশিদ জমা
            </Link>
            <Link
              className="rounded-xl bg-rose-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-rose-500"
              to={`${adminBase}/accounts/expense`}
            >
              ব্যয়/ভাউচার তৈরি
            </Link>
            <Link
              className="rounded-xl bg-slate-800 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
              to={`${adminBase}/accounts/transactions`}
            >
              সকল লেনদেন
            </Link>
            <Link
              className="rounded-xl bg-teal-700 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-teal-600"
              to={`${adminBase}/accounts/report`}
            >
              আয়-ব্যয় রিপোর্ট
            </Link>
          </div>
        </Card>
      </div>

      <Card padding="none" className="overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">সাম্প্রতিক লেনদেন</h2>
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
              {(data?.recentTransactions || []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-slate-400 dark:text-slate-500">
                    কোনো লেনদেন পাওয়া যায়নি
                  </td>
                </tr>
              )}
              {(data?.recentTransactions || []).map((item: RecentTransaction) => (
                <tr key={item.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-5 py-3 dark:text-slate-300">{item.entry_date}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        item.type === "income"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                          : "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                      }`}
                    >
                      {item.type === "income" ? "আয়" : "ব্যয়"}
                    </span>
                  </td>
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
