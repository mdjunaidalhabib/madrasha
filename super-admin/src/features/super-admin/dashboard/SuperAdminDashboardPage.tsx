import ChartCard from "@madrasha/shared-ui/src/components/ui/ChartCard";
import DeferredContent from "@madrasha/shared-ui/src/components/ui/DeferredContent";
import { lazy, useEffect, useState } from "react";

import adminApi from "../../../services/adminApi";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import StatTile from "@madrasha/shared-ui/src/components/ui/StatTile";
import Card, { CardHeader } from "@madrasha/shared-ui/src/components/ui/Card";
import Badge from "@madrasha/shared-ui/src/components/ui/Badge";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  useLang,
  useText,
} from "@madrasha/shared-ui/src/i18n";
import { dashboardText } from "./dashboard.text";
import LeadSummary from "../leads/LeadSummary";
import { Link } from "react-router-dom";
import PlatformActivityTable from "../activity/PlatformActivityTable";

const SuperAdminDashboardChart = lazy(
  () => import("./SuperAdminDashboardChart"),
);

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
  const money = (value: number | string) =>
    formatCurrency(Number(value || 0), lang);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(true);

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
        <StatTile
          label={t.totalInstitutions}
          value={stats?.totalMadrasas ?? 0}
          tone="indigo"
          loading={loading}
        />
        <StatTile
          label={t.active}
          value={stats?.activeMadrasas ?? 0}
          tone="emerald"
          loading={loading}
        />
        <StatTile
          label={t.inactive}
          value={stats?.inactiveMadrasas ?? 0}
          tone="amber"
          loading={loading}
        />
        <StatTile
          label={t.inTrash}
          value={stats?.trashedMadrasas ?? 0}
          tone="rose"
          loading={loading}
        />
        <StatTile
          label={t.totalStudents}
          value={stats?.totalStudents ?? 0}
          tone="blue"
          loading={loading}
        />
      </div>

      {/* CHARTS */}
      <div className="grid gap-6 xl:grid-cols-2">
        <DeferredContent
          fallback={
            <ChartCard
              title={t.growthTitle}
              subtitle={t.growthSubtitle}
              loading
              height="h-64"
            >
              {null}
            </ChartCard>
          }
        >
          <SuperAdminDashboardChart
            variant={0}
            trends={trends}
            trendsLoading={trendsLoading}
          />
        </DeferredContent>

        <DeferredContent
          fallback={
            <ChartCard
              title={t.revenueTitle}
              subtitle={t.revenueSubtitle}
              loading
              height="h-64"
            >
              {null}
            </ChartCard>
          }
        >
          <SuperAdminDashboardChart
            variant={1}
            trends={trends}
            trendsLoading={trendsLoading}
          />
        </DeferredContent>
      </div>

      {/* Expiring Plans */}
      <LeadSummary recent />
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
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {x.madrasa_name}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {x.slug} • {t.plan}: {x.plan_name} • {t.ends}:{" "}
                    {formatDate(x.end_date, lang)}
                  </div>
                </div>
                <Badge
                  tone={
                    (x.days_left ?? 0) <= 1
                      ? "red"
                      : (x.days_left ?? 0) <= 3
                        ? "yellow"
                        : "green"
                  }
                >
                  {t.daysLeft(formatNumber(x.days_left ?? 0, lang))}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Expired Plans */}
      <Card>
        <CardHeader
          title={
            <span className="text-rose-600 dark:text-rose-400">
              {t.expiredTitle}
            </span>
          }
        />
        {!stats?.expiredPlans?.length ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t.noExpired}
          </p>
        ) : (
          <div className="space-y-3">
            {stats.expiredPlans.map((x, i) => (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-xl border border-rose-100 bg-rose-50 p-3 dark:border-rose-900/40 dark:bg-rose-950/20 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {x.madrasa_name}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {x.slug} • {t.plan}: {x.plan_name} • {t.ended}:{" "}
                    {formatDate(x.end_date, lang)}
                  </div>
                </div>
                <Badge tone="red">
                  {t.daysOverdue(formatNumber(x.days_overdue ?? 0, lang))}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Recent Activity */}
      <Card padding="none" className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            সাম্প্রতিক কার্যক্রম
          </h3>
          <Link to="/activity" className="text-sm font-medium text-blue-700 hover:underline dark:text-blue-300">সব কার্যক্রম দেখুন</Link>
        </div>
        {!stats?.recentActivities?.length ? (
          <p className="px-5 py-6 text-sm text-slate-500 dark:text-slate-400">
            কোনো কার্যক্রম পাওয়া যায়নি।
          </p>
        ) : (
          <PlatformActivityTable rows={stats.recentActivities} compact />
        )}
      </Card>
    </div>
  );
}
