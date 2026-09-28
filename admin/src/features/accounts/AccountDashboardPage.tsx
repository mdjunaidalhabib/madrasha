import { ReactNode, useCallback, useEffect, useState } from "react";
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
import { Banknote, CalendarClock, Landmark, Pencil, Printer, Scale, TrendingDown, Trash2, Wallet } from "lucide-react";
import api, { cachedGet } from "../../services/api";
import Card from "@madrasha/shared-ui/src/components/ui/Card";
import ChartCard from "@madrasha/shared-ui/src/components/ui/ChartCard";
import { useThemeStore } from "@madrasha/shared-ui/src/store/themeStore";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import { AccountRow, money, partyName, toDateInput, toTimeInput } from "./accountHelpers";
import AccountReceiptModal from "./AccountReceiptModal";
import AccountEditModal from "./AccountEditModal";
import { commonText, useText } from "@madrasha/shared-ui/src/i18n";
import { accountsText } from "./accounts.text";

type IncomeExpensePoint = { period: string; total_income: number; total_expense: number };
type DashboardTrends = { incomeExpense: IncomeExpensePoint[] };
type FundBalance = { fund: string | null; balance: number | string };
type PaymentMethodTotal = { payment_method: string | null; income: number; expense: number };

const FUND_COLORS = ["#059669", "#d97706", "#4f46e5", "#e11d48", "#0ea5e9", "#7c3aed", "#0d9488", "#ca8a04"];
const ONLINE_METHOD = "online";
const OFFLINE_METHOD = "offline";

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
  sky: {
    border: "border-sky-100 dark:border-sky-900/40",
    bg: "from-sky-50 dark:from-sky-950/30",
    blob: "bg-sky-400/20",
    icon: "from-sky-500 to-cyan-500 shadow-sky-500/30",
    glow: "hover:shadow-sky-900/10",
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
      <div className={`pointer-events-none absolute -end-8 -top-8 h-28 w-28 rounded-full ${t.blob} blur-2xl transition-transform duration-300 group-hover:scale-110`} />
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

const MethodCard = ({
  icon,
  label,
  pct,
  amount,
  tone,
  shareLabel,
}: {
  icon: ReactNode;
  label: string;
  pct: number;
  amount: string;
  tone: "indigo" | "sky";
  shareLabel: string;
}) => {
  const t = STAT_TONES[tone];
  return (
    <div
      className={`relative overflow-hidden rounded-xl border ${t.border} bg-gradient-to-br ${t.bg} to-white p-4 shadow-sm transition-all duration-200 hover:shadow-md dark:to-slate-900`}
    >
      <div className={`pointer-events-none absolute -end-6 -top-6 h-16 w-16 rounded-full ${t.blob} blur-xl`} />
      <div className="relative flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <span className={`inline-flex rounded-lg bg-gradient-to-br ${t.icon} p-1.5 text-white shadow`}>{icon}</span>
          {label}
        </span>
        <span className={`rounded-full bg-gradient-to-r ${t.icon} px-2 py-0.5 text-xs font-bold text-white shadow`}>
          {pct}%
        </span>
      </div>
      <div className="relative mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/70 dark:bg-slate-800">
        <div className={`h-full rounded-full bg-gradient-to-r ${t.icon}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="relative mt-2.5 flex items-baseline justify-between">
        <span className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">{amount}</span>
        <span className="text-xs text-slate-400 dark:text-slate-500">{shareLabel}</span>
      </div>
    </div>
  );
};

export default function AccountDashboardPage() {
  const toast = useToastStore();
  const t = useText(accountsText);
  const c = useText(commonText);
  const [data, setData] = useState<any>(null);
  const [trends, setTrends] = useState<DashboardTrends | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(true);
  const [printingRow, setPrintingRow] = useState<AccountRow | null>(null);
  const [editingRow, setEditingRow] = useState<AccountRow | null>(null);
  const isDark = useThemeStore((s) => s.theme) === "dark";
  const gridColor = isDark ? "#334155" : "#e2e8f0";
  const axisColor = isDark ? "#64748b" : "#94a3b8";

  // ttlMs: 0 - see DashboardPage.tsx for why this summary call skips the
  // shared GET cache (বকেয়া ফি and the rest were showing pre-payment
  // numbers for up to 20s after a payment collected on another page).
  const reloadSummary = useCallback(async () => {
    const res = await cachedGet("/dashboard", undefined, 0);
    setData(res.data);
  }, []);

  useEffect(() => {
    reloadSummary();
    (async () => {
      try {
        const res = await cachedGet<DashboardTrends>("/dashboard/trends?groupBy=monthly");
        setTrends(res.data);
      } finally {
        setTrendsLoading(false);
      }
    })();

    const onFocus = () => reloadSummary();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reloadSummary]);

  const handleDelete = (row: AccountRow) => {
    useConfirmStore.getState().show({
      title: t.deleteEntryTitle,
      message: t.deleteEntryMessage(partyName(row), money(row.amount)),
      confirmText: t.deleteConfirm,
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/accounts/${row.id}`);
          toast.push("success", t.entryDeleted);
          reloadSummary();
        } catch (err: any) {
          const msg = err?.response?.data?.message || t.deleteFailed;
          toast.push("error", msg);
        }
      },
    });
  };

  const loading = !data;

  const fundData: { fund: string; balance: number }[] = (data?.fundBalances || [])
    .map((fund: FundBalance) => ({ fund: fund.fund || t.unassigned, balance: Number(fund.balance) || 0 }))
    .filter((fund: { fund: string; balance: number }) => fund.balance > 0);

  const paymentMethodTotals: PaymentMethodTotal[] = data?.paymentMethodTotals || [];
  const findMethodTotal = (method: string) =>
    paymentMethodTotals.find((row) => row.payment_method === method) || { income: 0, expense: 0 };
  const online = findMethodTotal(ONLINE_METHOD);
  const offline = findMethodTotal(OFFLINE_METHOD);
  const totalMethodIncome = online.income + offline.income;
  const onlinePct = totalMethodIncome ? Math.round((online.income / totalMethodIncome) * 100) : 0;
  const offlinePct = totalMethodIncome ? 100 - onlinePct : 0;

  const paymentMethodChartData = [
    { label: t.online, income: online.income, expense: online.expense },
    { label: t.offlineCash, income: offline.income, expense: offline.expense },
  ];

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: isDark ? "#1e293b" : "#ffffff",
      border: `1px solid ${gridColor}`,
      borderRadius: 12,
      fontSize: 13,
    },
    labelStyle: { color: isDark ? "#e2e8f0" : "#0f172a" },
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:col-span-4 xl:grid-cols-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <PremiumStatSkeleton key={i} />)
          ) : (
            <>
              <PremiumStat label={t.totalIncome} value={money(data.income)} tone="emerald" icon={<Wallet size={20} />} />
              <PremiumStat label={t.totalExpense} value={money(data.expense)} tone="rose" icon={<TrendingDown size={20} />} />
              <PremiumStat label={t.currentBalance} value={money(data.balance)} tone="indigo" icon={<Scale size={20} />} />
              <PremiumStat
                label={t.todayIncome}
                value={money(data.todayIncome)}
                subLabel={t.todayExpense(money(data.todayExpense))}
                tone="amber"
                icon={<CalendarClock size={20} />}
              />
            </>
          )}
        </div>

        <Card className="flex flex-col justify-center gap-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {t.quickActions}
          </p>
          <Link
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-emerald-500"
            to={`/accounts/income`}
          >
            {t.incomeReceiptEntry}
          </Link>
          <Link
            className="rounded-xl bg-rose-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-rose-500"
            to={`/accounts/expense`}
          >
            {t.expenseVoucherCreate}
          </Link>
          <Link
            className="rounded-xl bg-sky-700 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-500"
            to={`/accounts/transactions`}
          >
            {t.allTransactions}
          </Link>
          <Link
            className="rounded-xl bg-teal-700 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-teal-600"
            to={`/accounts/report`}
          >
            {t.incomeExpenseReport}
          </Link>
        </Card>
      </div>

      {!loading && (
        <div className="grid gap-4 sm:grid-cols-2">
          <MethodCard
            icon={<Landmark size={14} />}
            label={t.onlineIncome}
            shareLabel={t.shareOfIncome}
            pct={onlinePct}
            amount={money(online.income)}
            tone="indigo"
          />
          <MethodCard
            icon={<Banknote size={14} />}
            label={t.offlineIncome}
            shareLabel={t.shareOfIncome}
            pct={offlinePct}
            amount={money(offline.income)}
            tone="sky"
          />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <ChartCard
          title={t.trendTitle}
          subtitle={t.last12Months}
          loading={trendsLoading}
          empty={!trendsLoading && !trends?.incomeExpense?.length}
          className="xl:col-span-2"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trends?.incomeExpense || []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="period" stroke={axisColor} tick={{ fontSize: 12 }} />
              <YAxis stroke={axisColor} tick={{ fontSize: 12 }} width={48} />
              <Tooltip formatter={(value: unknown) => money(Number(value))} {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              <Line type="monotone" dataKey="total_income" name={t.income} stroke="#059669" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="total_expense" name={t.expense} stroke="#e11d48" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title={t.fundDistribution}
          subtitle={t.currentBalance}
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
              <Tooltip formatter={(value: unknown) => money(Number(value))} {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title={t.fundBalance}
          subtitle={t.fundBalanceSubtitle}
          actions={
            <Link className="text-sm font-medium text-emerald-600 dark:text-emerald-400" to={`/accounts/report`}>
              {t.viewReport}
            </Link>
          }
          loading={loading}
          empty={!loading && fundData.length === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={fundData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
              <XAxis type="number" stroke={axisColor} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="fund" stroke={axisColor} tick={{ fontSize: 12 }} width={100} />
              <Tooltip formatter={(value: unknown) => money(Number(value))} {...tooltipStyle} />
              <Bar dataKey="balance" radius={[0, 6, 6, 0]}>
                {fundData.map((entry, index) => (
                  <Cell key={entry.fund} fill={FUND_COLORS[index % FUND_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title={t.byMethodTitle}
          subtitle={t.byMethodSubtitle}
          loading={loading}
          empty={!loading && !online.income && !online.expense && !offline.income && !offline.expense}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={paymentMethodChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="label" stroke={axisColor} tick={{ fontSize: 12 }} />
              <YAxis stroke={axisColor} tick={{ fontSize: 12 }} width={48} />
              <Tooltip formatter={(value: unknown) => money(Number(value))} {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              <Bar dataKey="income" name={t.income} fill="#059669" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expense" name={t.expense} fill="#e11d48" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Card padding="none" className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{t.recentTransactions}</h2>
          <Link className="text-sm font-medium text-emerald-600 dark:text-emerald-400" to={`/accounts/transactions`}>
            {t.viewAll}
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-50 text-start text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3">{c.date}</th>
                <th className="px-5 py-3">{t.type}</th>
                <th className="px-5 py-3">{t.fundCategory}</th>
                <th className="px-5 py-3">{c.name}</th>
                <th className="px-5 py-3">{c.amount}</th>
                <th className="px-5 py-3 text-end">{c.actions}</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recentTransactions || []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-slate-400 dark:text-slate-500">
                    {t.noTransactions}
                  </td>
                </tr>
              )}
              {(data?.recentTransactions || []).map((item: AccountRow) => (
                <tr key={item.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="whitespace-nowrap px-5 py-3 dark:text-slate-300">
                    {toDateInput(item.entryDate)}{" "}
                    <span className="text-slate-400 dark:text-slate-500">{toTimeInput(item.entryTime)}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        item.type === "income"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                          : "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                      }`}
                    >
                      {item.type === "income" ? t.income : t.expense}
                    </span>
                  </td>
                  <td className="px-5 py-3 dark:text-slate-300">
                    {item.fund} <span className="text-slate-400 dark:text-slate-500">/ {item.category}</span>
                  </td>
                  <td className="px-5 py-3 font-medium dark:text-slate-100">{partyName(item)}</td>
                  <td
                    className={`px-5 py-3 font-semibold ${
                      item.type === "income" ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
                    }`}
                  >
                    {money(item.amount)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setPrintingRow(item)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:text-slate-500 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400"
                        title={item.type === "income" ? t.printReceipt : t.printVoucher}
                      >
                        <Printer size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingRow(item)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:text-slate-500 dark:hover:bg-blue-950/40 dark:hover:text-blue-400"
                        title={c.edit}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-500 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                        title={c.delete}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <AccountEditModal row={editingRow} onClose={() => setEditingRow(null)} onSaved={reloadSummary} />
      <AccountReceiptModal row={printingRow} onClose={() => setPrintingRow(null)} />
    </div>
  );
}
