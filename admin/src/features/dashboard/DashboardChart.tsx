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
import ChartCard from "@madrasha/shared-ui/src/components/ui/ChartCard";
import { useThemeStore } from "@madrasha/shared-ui/src/store/themeStore";
import { formatCurrency, getLang, useText } from "@madrasha/shared-ui/src/i18n";
import { dashboardText } from "./dashboard.text";

type Props = {
  variant: number;
  data: any;
  trends: {
    incomeExpense: { period: string; total_income: number; total_expense: number }[];
    attendance: { period: string; percentage: number }[];
  } | null;
  loading: boolean;
  trendsLoading: boolean;
};
export default function DashboardChart({ variant, data, trends, loading, trendsLoading }: Props) {
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
  const t = useText(dashboardText);
  const isDark = useThemeStore((s) => s.theme) === "dark";
  const gridColor = isDark ? "#334155" : "#e2e8f0";
  const axisColor = isDark ? "#64748b" : "#94a3b8";
  const money = (value: number | string) => formatCurrency(Number(value || 0), getLang());
  const channelTotal = (method: string) => {
    const row = (data?.paymentMethodTotals || []).find((r: any) => r.payment_method === method);
    return { income: Number(row?.income || 0), expense: Number(row?.expense || 0) };
  };
  const onlineTotal = channelTotal("online"),
    offlineTotal = channelTotal("offline");
  const fundData = (data?.fundBalances || [])
    .map((fund: any) => ({
      fund: fund.fund || t.unassigned,
      balance: Number(fund.balance) || 0,
    }))
    .filter((fund: any) => fund.balance > 0);

  const genderData = data
    ? [
        { name: t.boys, value: data.studentsByGender?.male ?? 0 },
        { name: t.girls, value: data.studentsByGender?.female ?? 0 },
      ].filter((g) => g.value > 0)
    : [];

  const channelData = data
    ? [
        { channel: t.online, income: onlineTotal.income, expense: onlineTotal.expense },
        { channel: t.offline, income: offlineTotal.income, expense: offlineTotal.expense },
      ]
    : [];

  const channelShareData = channelData
    .map((c) => ({ name: c.channel, value: c.income + c.expense }))
    .filter((c) => c.value > 0);

  switch (variant) {
    case 0:
      return (
        <ChartCard
          title={t.incomeExpenseTrend}
          subtitle={t.sessionPeriod}
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
                name={t.income}
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="total_expense"
                name={t.expense}
                stroke="#f43f5e"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      );
    case 1:
      return (
        <ChartCard
          title={t.attendanceRate}
          subtitle={t.attendanceRateSub}
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
                name={t.attendancePct}
                fill="#6366f1"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      );
    case 2:
      return (
        <ChartCard
          title={t.fundDistribution}
          subtitle={t.fundDistributionSub}
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
      );
    case 3:
      return (
        <ChartCard
          title={t.genderRatio}
          subtitle={t.genderRatioSub}
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
      );
    case 4:
      return (
        <ChartCard
          title={t.onlineVsOffline}
          subtitle={t.onlineVsOfflineSub}
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
              <Bar dataKey="income" name={t.income} fill="#10b981" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expense" name={t.expense} fill="#f43f5e" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      );
    case 5:
      return (
        <ChartCard
          title={t.paymentMethods}
          subtitle={t.paymentMethodsSub}
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
      );
    default:
      return null;
  }
}
