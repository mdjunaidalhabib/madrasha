import { useEffect, useState } from "react";
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
import adminApi from "../../../services/adminApi";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import StatTile from "@madrasha/shared-ui/src/components/ui/StatTile";
import Card, { CardHeader } from "@madrasha/shared-ui/src/components/ui/Card";
import ChartCard from "@madrasha/shared-ui/src/components/ui/ChartCard";
import Badge from "@madrasha/shared-ui/src/components/ui/Badge";
import { useThemeStore } from "@madrasha/shared-ui/src/store/themeStore";
import { formatCurrency, formatDate, formatDateTime, formatNumber, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { dashboardText } from "./dashboard.text";

type ActivityItem = {
  id: number;
  madrasa_name: string | null;
  user_name: string | null;
  action: string | null;
  entity: string | null;
  entity_id: number | null;
  details: string | null;
  created_at: string;
};

type PlanItem = {
  madrasa_name: string;
  slug: string;
  plan_name: string;
  end_date: string;
  days_left?: number;
  days_overdue?: number;
};

type Stats = {
  totalMadrasas: number;
  activeMadrasas: number;
  inactiveMadrasas: number;
  trashedMadrasas: number;
  totalStudents: number;

  recentActivities: ActivityItem[];
  expiringPlans: PlanItem[];
  expiredPlans: PlanItem[];
};

type Trends = {
  madrasaGrowth: { period: string; count: number }[];
  revenue: { period: string; total: number }[];
};

export default function SuperAdminDashboardPage() {
  const t = useText(dashboardText);
  const lang = useLang();
  const money = (value: number | string) => formatCurrency(Number(value || 0), lang);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(true);
  const isDark = useThemeStore((s) => s.theme) === "dark";
  const gridColor = isDark ? "#334155" : "#e2e8f0";
  const axisColor = isDark ? "#64748b" : "#94a3b8";

  useEffect(() => {
    load();
    loadTrends();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await adminApi.get("/super/dashboard-stats");
      setStats(res.data);
    } finally {
      setLoading(false);
    }
  };

  const loadTrends = async () => {
    try {
      setTrendsLoading(true);
      const res = await adminApi.get("/super/dashboard-trends?groupBy=monthly");
      setTrends(res.data);
    } finally {
      setTrendsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t.title} subtitle={t.subtitle} />

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label={t.totalInstitutions} value={stats?.totalMadrasas ?? 0} tone="indigo" loading={loading} />
        <StatTile label={t.active} value={stats?.activeMadrasas ?? 0} tone="emerald" loading={loading} />
        <StatTile label={t.inactive} value={stats?.inactiveMadrasas ?? 0} tone="amber" loading={loading} />
        <StatTile label={t.inTrash} value={stats?.trashedMadrasas ?? 0} tone="rose" loading={loading} />
        <StatTile label={t.totalStudents} value={stats?.totalStudents ?? 0} tone="blue" loading={loading} />
      </div>

      {/* CHARTS */}
      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title={t.growthTitle}
          subtitle={t.growthSubtitle}
          loading={trendsLoading}
          empty={!trendsLoading && !trends?.madrasaGrowth?.length}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trends?.madrasaGrowth || []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="madrasaGrowthFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="period" stroke={axisColor} tick={{ fontSize: 12 }} />
              <YAxis stroke={axisColor} tick={{ fontSize: 12 }} width={36} allowDecimals={false} />
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

        <ChartCard
          title={t.revenueTitle}
          subtitle={t.revenueSubtitle}
          loading={trendsLoading}
          empty={!trendsLoading && !trends?.revenue?.length}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trends?.revenue || []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
              <Line type="monotone" dataKey="total" name={t.revenue} stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Expiring Plans */}
      <Card>
        <CardHeader title={t.expiringTitle} />
        {!stats?.expiringPlans?.length ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t.noExpiring}
          </p>
        ) : (
          <div className="space-y-3">
            {stats.expiringPlans.map((x, i) => (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-medium text-slate-900 dark:text-slate-100">{x.madrasa_name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {x.slug} • {t.plan}: {x.plan_name} • {t.ends}: {formatDate(x.end_date, lang)}
                  </div>
                </div>
                <Badge tone={(x.days_left ?? 0) <= 1 ? "red" : (x.days_left ?? 0) <= 3 ? "yellow" : "green"}>
                  {t.daysLeft(formatNumber(x.days_left ?? 0, lang))}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Expired Plans */}
      <Card>
        <CardHeader title={<span className="text-rose-600 dark:text-rose-400">{t.expiredTitle}</span>} />
        {!stats?.expiredPlans?.length ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.noExpired}</p>
        ) : (
          <div className="space-y-3">
            {stats.expiredPlans.map((x, i) => (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-xl border border-rose-100 bg-rose-50 p-3 dark:border-rose-900/40 dark:bg-rose-950/20 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-medium text-slate-900 dark:text-slate-100">{x.madrasa_name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {x.slug} • {t.plan}: {x.plan_name} • {t.ended}:{" "}
                    {formatDate(x.end_date, lang)}
                  </div>
                </div>
                <Badge tone="red">{t.daysOverdue(formatNumber(x.days_overdue ?? 0, lang))}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Recent Activity */}
      <Card padding="none" className="overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{t.recentActivity}</h3>
        </div>
        {!stats?.recentActivities?.length ? (
          <p className="px-5 py-6 text-sm text-slate-500 dark:text-slate-400">{t.noActivity}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-start text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3">{t.colTime}</th>
                  <th className="px-5 py-3">{t.colInstitution}</th>
                  <th className="px-5 py-3">{t.colUser}</th>
                  <th className="px-5 py-3">{t.colAction}</th>
                  <th className="px-5 py-3">{t.colEntity}</th>
                  <th className="px-5 py-3">{t.colDetails}</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentActivities.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                      {formatDateTime(a.created_at, lang)}
                    </td>
                    <td className="px-5 py-3 dark:text-slate-300">{a.madrasa_name || "-"}</td>
                    <td className="px-5 py-3 dark:text-slate-300">{a.user_name || "-"}</td>
                    <td className="px-5 py-3">
                      <Badge tone="blue">{a.action}</Badge>
                    </td>
                    <td className="px-5 py-3 dark:text-slate-300">
                      {a.entity}
                      {a.entity_id ? `#${a.entity_id}` : ""}
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{a.details || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
