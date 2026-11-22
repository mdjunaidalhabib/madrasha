import ChartCard from "@madrasha/shared-ui/src/components/ui/ChartCard";
import DeferredContent from "@madrasha/shared-ui/src/components/ui/DeferredContent";
import { lazy, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  formatCurrency,
  getLang,
  localizeDigits,
  useLang,
  useText,
} from "@madrasha/shared-ui/src/i18n";
import { dashboardText } from "./dashboard.text";
import { Link } from "react-router-dom";

import {
  AlertTriangle,
  Banknote,
  BarChart3,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
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
import { useAuthStore } from "../../store/authStore";
import { getPublicSiteUrl } from "../../utils/publicSiteUrl";
import VendorPromoCard from "../vendor/VendorPromoCard";
import type { Session } from "../../services/sessionApi";

const money = (value: number | string) => formatCurrency(value || 0, getLang());

const DashboardChart = lazy(() => import("./DashboardChart"));

function DashboardSection({
  id,
  title,
  subtitle,
  icon,
  action,
  children,
}: {
  id: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className={`min-w-0 ${id === "reports-overview" ? "space-y-4" : "space-y-2"}`}
    >
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-slate-400 dark:text-slate-500 [&>svg]:h-3.5 [&>svg]:w-3.5">
          {icon}
        </span>
        <div className="min-w-0 shrink-0">
          <h2
            id={`${id}-heading`}
            className="text-xs font-semibold text-slate-500 dark:text-slate-400"
          >
            {title}
          </h2>
          <p className="sr-only">{subtitle}</p>
        </div>
        <span
          aria-hidden="true"
          className="h-px min-w-0 flex-1 bg-slate-200/70 dark:bg-slate-800"
        />
        {action}
      </div>
      {children}
    </section>
  );
}

type IncomeExpensePoint = {
  period: string;
  total_income: number;
  total_expense: number;
};
type AttendancePoint = { period: string; percentage: number };
type DashboardTrends = {
  incomeExpense: IncomeExpensePoint[];
  attendance: AttendancePoint[];
};

export default function DashboardPage() {
  const t = useText(dashboardText);
  const lang = useLang();
  const [data, setData] = useState<any>(null);
  const [trends, setTrends] = useState<DashboardTrends | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(true);
  const [selection, setSelection] = useState("active");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const madrasaSlug = useAuthStore((s) => s.madrasaSlug) || "";
  const publicUrl = getPublicSiteUrl(madrasaSlug);

  useEffect(() => {
    let controller: AbortController;
    const loadDashboard = async () => {
      controller?.abort();
      controller = new AbortController();
      const { signal } = controller;
      setData(null);
      setTrends(null);
      setTrendsLoading(true);
      setError(false);
      try {
        // Commit summary and charts together; cancelled requests can never
        // replace the currently selected session with an older response.
        const [summary, trend] = await Promise.all([
          cachedGet("/dashboard", { params: { session: selection }, signal }, 0),
          cachedGet<DashboardTrends>(
            "/dashboard/trends",
            { params: { session: selection, groupBy: "monthly" }, signal },
            0,
          ),
        ]);
        if (signal.aborted) return;
        setSessions(summary.data.sessionContext.sessions);
        setData(summary.data);
        setTrends(trend.data);
      } catch {
        if (!signal.aborted) setError(true);
      } finally {
        if (!signal.aborted) setTrendsLoading(false);
      }
    };
    void loadDashboard();
    const onFocus = () => loadDashboard();
    window.addEventListener("focus", onFocus);
    return () => {
      controller?.abort();
      window.removeEventListener("focus", onFocus);
    };
  }, [selection, refreshKey, madrasaSlug]);

  const loading = !data;
  const selectedSessions = sessions.filter(
    (session) =>
      selection === "all" ||
      (selection === "active" ? session.isActive : String(session.id) === selection),
  );
  const sessionName = (session: Session) => {
    const division = session.division?.nameBn || session.division?.name;
    return division ? `${session.name} · ${division}` : session.name;
  };
  const activeSessions = sessions.filter((session) => session.isActive);
  const singleActiveSession = activeSessions.length === 1 ? activeSessions[0] : null;
  const activeSessionNames = activeSessions
    .map((session) => localizeDigits(sessionName(session), lang))
    .join(", ");
  const activeSessionLabel = activeSessionNames
    ? `${t.activeSessions} · ${activeSessionNames}`
    : t.activeSessions;
  const activeOptionLabel = singleActiveSession
    ? `${localizeDigits(sessionName(singleActiveSession), lang)} (${t.activeBadge})`
    : t.activeSessions;
  const sessionOptions = sessions.filter((session) => session.id !== singleActiveSession?.id);
  const selectValue = singleActiveSession && selection === String(singleActiveSession.id)
    ? "active"
    : selection;
  const hasActiveSelection =
    selection !== "all" && selectedSessions.some((session) => session.isActive);

  const upcomingExams = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return (data?.upcomingExams || [])
      .filter((exam: any) => new Date(exam.examDate) >= today)
      .sort((a: any, b: any) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime());
  }, [data?.upcomingExams]);

  const getChannelTotal = (method: "online" | "offline") => {
    const row = (data?.paymentMethodTotals || []).find((r: any) => r.payment_method === method);
    return {
      income: Number(row?.income || 0),
      expense: Number(row?.expense || 0),
    };
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
          label: t.totalStudents,
          value: data.students,
          tone: "blue" as const,
          icon: <Users className="h-5 w-5" strokeWidth={1.75} />,
        },
        {
          label: t.maleStudents,
          value: data.studentsByGender?.male ?? 0,
          tone: "blue" as const,
          icon: <User className="h-5 w-5" strokeWidth={1.75} />,
        },
        {
          label: t.femaleStudents,
          value: data.studentsByGender?.female ?? 0,
          tone: "rose" as const,
          icon: <UserRound className="h-5 w-5" strokeWidth={1.75} />,
        },
        {
          label: t.totalTeachers,
          value: data.teachers,
          tone: "indigo" as const,
          icon: <GraduationCap className="h-5 w-5" strokeWidth={1.75} />,
        },
        {
          label: t.totalIncome,
          value: data.income,
          tone: "emerald" as const,
          variant: "currency" as const,
          icon: <TrendingUp className="h-5 w-5" strokeWidth={1.75} />,
        },
        {
          label: t.totalExpense,
          value: data.expense,
          tone: "rose" as const,
          variant: "currency" as const,
          icon: <TrendingDown className="h-5 w-5" strokeWidth={1.75} />,
        },
        {
          label: t.currentBalance,
          value: data.currentBalance,
          tone: "slate" as const,
          variant: "currency" as const,
          icon: <Scale className="h-5 w-5" strokeWidth={1.75} />,
        },
        {
          label: t.todayIncomeExpense,
          value: data.todayIncome,
          tone: "amber" as const,
          variant: "currency" as const,
          subLabel: t.expenseSub(money(data.todayExpense)),
          icon: <CalendarClock className="h-5 w-5" strokeWidth={1.75} />,
        },
        {
          label: t.onlineIncome,
          value: onlineTotal.income,
          tone: "blue" as const,
          variant: "currency" as const,
          subLabel: t.ofTotalIncome(localizeDigits(onlineIncomePct, lang)),
          icon: <Wifi className="h-5 w-5" strokeWidth={1.75} />,
        },
        {
          label: t.offlineIncome,
          value: offlineTotal.income,
          tone: "amber" as const,
          variant: "currency" as const,
          subLabel: t.ofTotalIncome(localizeDigits(offlineIncomePct, lang)),
          icon: <Banknote className="h-5 w-5" strokeWidth={1.75} />,
        },
      ];

  const cardGroups = [
    {
      id: "academic-overview",
      title: t.academicOverview,
      subtitle: t.academicOverviewSub,
      icon: <GraduationCap className="h-5 w-5" strokeWidth={1.75} />,
      cards: cards.slice(0, 4),
      count: 4,
    },
    {
      id: "financial-overview",
      title: t.financialOverview,
      subtitle: t.financialOverviewSub,
      icon: <Wallet className="h-5 w-5" strokeWidth={1.75} />,
      cards: cards.slice(4, 8),
      count: 4,
    },
    {
      id: "income-channels",
      title: t.paymentOverview,
      subtitle: t.paymentOverviewSub,
      icon: <Banknote className="h-5 w-5" strokeWidth={1.75} />,
      cards: cards.slice(8),
      count: 2,
    },
  ];

  // Rendered twice: after the summary on mobile, in the sidebar on xl.
  const quickActions = (
    <Card>
      <CardHeader
        title={t.quickActions}
        subtitle={t.quickActionsSub}
        nowrap
        actions={
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-sky-600/20 transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-sky-600/30"
          >
            <ExternalLink size={13} />
            {t.viewWebsite}
          </a>
        }
      />
      <div className="space-y-2">
        <Link
          className="flex items-center gap-3 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-indigo-500 hover:shadow-md"
          to={`/accounts/income`}
        >
          <Wallet className="h-5 w-5 shrink-0" strokeWidth={1.75} />
          {t.incomeEntry}
        </Link>
        <Link
          className="flex items-center gap-3 rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-rose-500 hover:shadow-md"
          to={`/accounts/expense`}
        >
          <ReceiptText className="h-5 w-5 shrink-0" strokeWidth={1.75} />
          {t.expenseEntry}
        </Link>
        <Link
          className="flex items-center gap-3 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-violet-500 hover:shadow-md"
          to={`/students/new`}
        >
          <UserPlus className="h-5 w-5 shrink-0" strokeWidth={1.75} />
          {t.newAdmission}
        </Link>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      {error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"
        >
          <span>{t.loadError}</span>
          <button
            type="button"
            onClick={() => setRefreshKey((key) => key + 1)}
            className="rounded-lg border border-current px-3 py-2 font-semibold"
          >
            {t.retry}
          </button>
        </div>
      ) : (
        <>
          {!loading && selection === "active" && selectedSessions.length === 0 && (
            <div
              role="status"
              className="flex flex-wrap items-center gap-2 text-sm text-amber-700 dark:text-amber-400"
            >
              <span>{t.noActiveSession}</span>
              <Link
                to="/talimat/settings/sessions"
                className="font-semibold underline underline-offset-4"
              >
                {t.sessionSettings}
              </Link>
            </div>
          )}
          <div className="grid items-start gap-6 xl:grid-cols-4" aria-busy={loading}>
            <div className="min-w-0 space-y-4 xl:col-span-3">
              {cardGroups.map((group) => (
                <DashboardSection
                  key={group.id}
                  {...group}
                  action={
                    group.id === "academic-overview" ? (
                      <div className="flex min-w-0 max-w-[60%] items-center gap-1.5">
                        <label htmlFor="dashboard-session" className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">
                          {t.sessionPrefix}
                        </label>
                        <div className="relative min-w-0">
                        {hasActiveSelection && (
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute start-2.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-emerald-500 dark:bg-emerald-400"
                          />
                        )}
                        <select
                          id="dashboard-session"
                          aria-label={t.sessionLabel}
                          value={selectValue}
                          title={selection === "active" ? activeSessionLabel : undefined}
                          onChange={(event) => setSelection(event.target.value)}
                          className={`h-8 max-w-full appearance-none rounded-lg border border-slate-200 bg-white py-1 pe-7 text-xs font-medium text-slate-600 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 ${hasActiveSelection ? "ps-6" : "ps-2.5"}`}
                        >
                          <option value="active">{activeOptionLabel}</option>
                          <option value="all">{t.allSessions}</option>
                          {sessionOptions.map((session) => (
                            <option key={session.id} value={session.id}>
                              {localizeDigits(sessionName(session), lang)}
                              {session.isActive ? ` (${t.activeBadge})` : ""}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={14}
                          className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        </div>
                      </div>
                    ) : undefined
                  }
                >
                  <div
                    className={`grid grid-cols-2 gap-2.5 ${group.count === 4 ? "lg:grid-cols-4" : ""}`}
                  >
                    {loading
                      ? Array.from({ length: group.count }).map((_, i) => (
                          <StatTile key={i} label="" value="" loading size="sm" />
                        ))
                      : group.cards.map((card) => (
                          <StatTile key={card.label} {...card} size="sm" />
                        ))}
                  </div>
                </DashboardSection>
              ))}

              <DashboardSection
                id="daily-overview"
                title={t.dailyOverview}
                subtitle={t.dailyOverviewSub}
                icon={<CalendarClock className="h-5 w-5" strokeWidth={1.75} />}
              >
                <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <StatTile key={i} label="" value="" loading size="sm" />
                    ))
                  ) : (
                    <>
                      <StatTile
                        label={t.todayAttendance}
                        value={data.attendanceToday.percentage}
                        variant="percentage"
                        tone="emerald"
                        subLabel={t.attendanceTaken(
                          localizeDigits(data.attendanceToday.total, lang),
                        )}
                        to={`/attendance/mark`}
                        size="sm"
                        icon={<CheckCircle2 className="h-5 w-5" strokeWidth={1.75} />}
                      />
                      <StatTile
                        label={t.pendingAdmissions}
                        value={data.pendingAdmissionsCount}
                        tone="amber"
                        to={`/students/admissions/pending`}
                        size="sm"
                        icon={<Hourglass className="h-5 w-5" strokeWidth={1.75} />}
                      />
                      <StatTile
                        label={t.overdueFees}
                        value={data.overdueFees.totalDue}
                        variant="currency"
                        tone="rose"
                        subLabel={t.overdueStudents(
                          localizeDigits(data.overdueFees.studentCount, lang),
                        )}
                        to={`/fee/overdue-fee`}
                        size="sm"
                        icon={<AlertTriangle className="h-5 w-5" strokeWidth={1.75} />}
                      />
                      <StatTile
                        label={t.upcomingExams}
                        value={data.upcomingExams.length}
                        tone="indigo"
                        to={`/routine`}
                        size="sm"
                        icon={<CalendarDays className="h-5 w-5" strokeWidth={1.75} />}
                      />
                    </>
                  )}
                </div>
              </DashboardSection>

              <div className="xl:hidden">{quickActions}</div>

              <DashboardSection
                id="reports-overview"
                title={t.reportsOverview}
                subtitle={t.reportsOverviewSub}
                icon={<BarChart3 className="h-5 w-5" strokeWidth={1.75} />}
              >
                <Card>
                  <CardHeader title={t.upcomingExams} subtitle={t.upcomingExamsSub} />
                  {!loading && upcomingExams.length === 0 && (
                    <p className="py-2 text-center text-xs text-slate-400 dark:text-slate-500">
                      {t.noUpcomingExams}
                    </p>
                  )}
                  {/* One column, in routine order (date → time → শ্রেণি, see
                dashboard.repository findUpcomingExams) - a 2-col grid read
                start-to-right scattered same-day slots. */}
                  <div className="flex flex-col gap-1.5">
                    {upcomingExams.map((exam: any) => (
                      <div
                        key={exam.id}
                        className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-sm dark:bg-slate-800"
                      >
                        <span className="w-24 shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-center text-[11px] font-medium tabular-nums text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                          {new Date(exam.examDate).toLocaleDateString("bn-BD", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          <span className="font-medium text-slate-700 dark:text-slate-200">
                            {exam.examName}
                            {exam.className ? ` · ${exam.className}` : ""}
                          </span>
                          {exam.subject && (
                            <span className="text-slate-500 dark:text-slate-400">
                              {" "}
                              — {exam.subject}
                            </span>
                          )}
                        </span>
                        {exam.startTime && exam.endTime && (
                          <span className="shrink-0 text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                            {exam.startTime}-{exam.endTime}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>

                <div className="grid gap-4 xl:grid-cols-2">
                  <DeferredContent
                    fallback={
                      <ChartCard
                        title={t.incomeExpenseTrend}
                        subtitle={t.sessionPeriod}
                        loading
                        height="h-48"
                      >
                        {null}
                      </ChartCard>
                    }
                  >
                    <DashboardChart
                      variant={0}
                      data={data}
                      trends={trends}
                      loading={loading}
                      trendsLoading={trendsLoading}
                    />
                  </DeferredContent>

                  <DeferredContent
                    fallback={
                      <ChartCard
                        title={t.attendanceRate}
                        subtitle={t.attendanceRateSub}
                        loading
                        height="h-48"
                      >
                        {null}
                      </ChartCard>
                    }
                  >
                    <DashboardChart
                      variant={1}
                      data={data}
                      trends={trends}
                      loading={loading}
                      trendsLoading={trendsLoading}
                    />
                  </DeferredContent>
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                  <DeferredContent
                    fallback={
                      <ChartCard title={t.fundDistribution} loading height="h-48">
                        {null}
                      </ChartCard>
                    }
                  >
                    <DashboardChart
                      variant={2}
                      data={data}
                      trends={trends}
                      loading={loading}
                      trendsLoading={trendsLoading}
                    />
                  </DeferredContent>

                  <Card>
                    <CardHeader
                      title={t.fundBalance}
                      subtitle={t.fundDistributionSub}
                      actions={
                        <Link
                          className="text-sm font-medium text-indigo-600 dark:text-indigo-400"
                          to={`/accounts/report`}
                        >
                          {t.viewReport}
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
                            {fund.fund || t.unassigned}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {money(fund.balance)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <DeferredContent
                    fallback={
                      <ChartCard
                        title={t.genderRatio}
                        subtitle={t.genderRatioSub}
                        loading
                        height="h-48"
                      >
                        {null}
                      </ChartCard>
                    }
                  >
                    <DashboardChart
                      variant={3}
                      data={data}
                      trends={trends}
                      loading={loading}
                      trendsLoading={trendsLoading}
                    />
                  </DeferredContent>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <DeferredContent
                    fallback={
                      <ChartCard
                        title={t.onlineVsOffline}
                        subtitle={t.onlineVsOfflineSub}
                        loading
                        height="h-48"
                      >
                        {null}
                      </ChartCard>
                    }
                  >
                    <DashboardChart
                      variant={4}
                      data={data}
                      trends={trends}
                      loading={loading}
                      trendsLoading={trendsLoading}
                    />
                  </DeferredContent>

                  <DeferredContent
                    fallback={
                      <ChartCard
                        title={t.paymentMethods}
                        subtitle={t.paymentMethodsSub}
                        loading
                        height="h-48"
                      >
                        {null}
                      </ChartCard>
                    }
                  >
                    <DashboardChart
                      variant={5}
                      data={data}
                      trends={trends}
                      loading={loading}
                      trendsLoading={trendsLoading}
                    />
                  </DeferredContent>
                </div>
              </DashboardSection>
            </div>

            <div className="min-w-0 space-y-6 xl:col-span-1">
              <div className="hidden xl:block">{quickActions}</div>

              <Card>
                <CardHeader title={t.importantLinks} subtitle={t.importantLinksSub} />
                <div className="space-y-2">
                  {(data?.importantLinks || []).length === 0 && !loading && (
                    <p className="py-2 text-center text-xs text-slate-400 dark:text-slate-500">
                      {t.noLinks}
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
                  title={t.recentTransactions}
                  actions={
                    <Link
                      className="text-sm font-medium text-indigo-600 dark:text-indigo-400"
                      to={`/accounts/transactions`}
                    >
                      {t.viewAll}
                    </Link>
                  }
                />
                <div className="space-y-2">
                  {!loading && (data?.recentTransactions || []).length === 0 && (
                    <p className="py-2 text-center text-xs text-slate-400 dark:text-slate-500">
                      {t.noTransactions}
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
                  title={t.overdueList}
                  subtitle={
                    !loading ? t.totalAmount(money(data?.overdueFees?.totalDue || 0)) : undefined
                  }
                  actions={
                    <Link
                      className="text-sm font-medium text-indigo-600 dark:text-indigo-400"
                      to={`/fee/overdue-fee`}
                    >
                      {t.viewAll}
                    </Link>
                  }
                />
                <div className="space-y-2">
                  {!loading && (data?.overdueFees?.list || []).length === 0 && (
                    <p className="py-2 text-center text-xs text-slate-400 dark:text-slate-500">
                      {t.noOverdue}
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
                          {t.overdueInvoices(localizeDigits(item.invoiceCount, lang))}
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
        </>
      )}
    </div>
  );
}
