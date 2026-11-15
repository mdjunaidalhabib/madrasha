import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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
  trends: {
    madrasaGrowth: { period: string; count: number }[];
    revenue: { period: string; total: number }[];
  } | null;
  trendsLoading: boolean;
};
export default function SuperAdminDashboardChart({
  variant,
  trends,
  trendsLoading,
}: Props) {
  const t = useText(dashboardText);
  const isDark = useThemeStore((s) => s.theme) === "dark";
  const gridColor = isDark ? "#334155" : "#e2e8f0";
  const axisColor = isDark ? "#64748b" : "#94a3b8";
  const money = (value: number | string) =>
    formatCurrency(Number(value || 0), getLang());

  switch (variant) {
    case 0:
      return (
        <ChartCard
          title={t.growthTitle}
          subtitle={t.growthSubtitle}
          loading={trendsLoading}
          empty={!trendsLoading && !trends?.madrasaGrowth?.length}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={trends?.madrasaGrowth || []}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id="madrasaGrowthFill"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={gridColor}
                vertical={false}
              />
              <XAxis
                dataKey="period"
                stroke={axisColor}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                stroke={axisColor}
                tick={{ fontSize: 12 }}
                width={36}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? "#1e293b" : "#ffffff",
                  border: `1px solid ${gridColor}`,
                  borderRadius: 12,
                  fontSize: 13,
                }}
                labelStyle={{ color: isDark ? "#e2e8f0" : "#0f172a" }}
              />
              <Area
                type="monotone"
                dataKey="count"
                name={t.newInstitutions}
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#madrasaGrowthFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      );
    case 1:
      return (
        <ChartCard
          title={t.revenueTitle}
          subtitle={t.revenueSubtitle}
          loading={trendsLoading}
          empty={!trendsLoading && !trends?.revenue?.length}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={trends?.revenue || []}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={gridColor}
                vertical={false}
              />
              <XAxis
                dataKey="period"
                stroke={axisColor}
                tick={{ fontSize: 12 }}
              />
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
                dataKey="total"
                name={t.revenue}
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      );
    default:
      return null;
  }
}
