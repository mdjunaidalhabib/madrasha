import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Briefcase,
  CalendarOff,
  ExternalLink,
  GraduationCap,
  Phone,
  RefreshCw,
  Users,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import StatTile from "@madrasha/shared-ui/src/components/ui/StatTile";
import ErrorState from "@madrasha/shared-ui/src/components/ui/ErrorState";
import { SkeletonChart, SkeletonList, SkeletonTable } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { useThemeStore } from "@madrasha/shared-ui/src/store/themeStore";
import { formatDate, formatNumber, localizeDigits, useLang, useText } from "@madrasha/shared-ui/src/i18n";

import {
  alertsApi,
  analyticsApi,
  currentMonth,
  localIso,
  monthStartIso,
  type ConsecutiveAbsence,
  type LowAttendanceRow,
  type Overview,
  type Totals,
  type TrendPoint,
} from "../../services/attendanceV3Api";
import { EmptyRow, Field, Panel, RateBar, fieldClass, formatPercent, tdClass, thClass } from "./shared";
import { attendanceAnalyticsText } from "./attendanceAnalytics.text";

const LOW_PREVIEW = 10;

export default function AttendanceDashboardPage() {
  const t = useText(attendanceAnalyticsText).dashboard;
  const lang = useLang();
  const n = (v: number) => formatNumber(v ?? 0, lang);
  const types = useText(attendanceAnalyticsText).attendeeTypes;
  const today = localIso();

  const [date, setDate] = useState(today);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState(false);

  // Focused class (click a row in the class table) - drives trend + low list.
  const [focus, setFocus] = useState<{ id: number; name: string } | null>(null);

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError(false);
    try {
      setOverview(await analyticsApi.overview(date, { silent: true }));
    } catch {
      setOverviewError(true);
    } finally {
      setOverviewLoading(false);
    }
  }, [date]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const offDayLabel = overview?.off_day
    ? overview.off_day.title ||
      (overview.off_day.reason === "weekly_off"
        ? t.weeklyOff
        : overview.off_day.reason === "holiday"
          ? t.holiday
          : t.offDay)
    : null;

  const tile = (totals: Totals | undefined) =>
    totals ? t.tileSub(n(totals.present + totals.late), n(totals.total), n(totals.unmarked)) : undefined;

  const classes = useMemo(
    () => (overview?.classes ?? []).slice().sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0) || a.class_name.localeCompare(b.class_name)),
    [overview],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-3 sm:p-4 md:p-6">
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <div className="flex items-end gap-2">
            <input
              type="date"
              aria-label={t.date}
              className={`${fieldClass} w-[160px]`}
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value || today)}
            />
            <Button variant="secondary" className="h-10" onClick={loadOverview} title={t.refresh}>
              <RefreshCw size={16} className={overviewLoading ? "animate-spin" : ""} />
            </Button>
          </div>
        }
      />

      {offDayLabel && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <CalendarOff size={18} />
          {offDayLabel}
        </div>
      )}

      {overviewError ? (
        <ErrorState message={t.loadFailed} onRetry={loadOverview} />
      ) : (
        <>
          {/* Today's tiles */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile
              label={types.STUDENT}
              value={formatPercent(overview?.students.rate ?? 0)}
              variant="percentage"
              tone="indigo"
              subLabel={tile(overview?.students)}
              loading={overviewLoading && !overview}
              icon={<GraduationCap size={20} />}
            />
            <StatTile
              label={types.TEACHER}
              value={formatPercent(overview?.teachers.rate ?? 0)}
              variant="percentage"
              tone="emerald"
              subLabel={tile(overview?.teachers)}
              loading={overviewLoading && !overview}
              icon={<Users size={20} />}
            />
            <StatTile
              label={types.STAFF}
              value={formatPercent(overview?.staff.rate ?? 0)}
              variant="percentage"
              tone="amber"
              subLabel={tile(overview?.staff)}
              loading={overviewLoading && !overview}
              icon={<Briefcase size={20} />}
            />
          </div>

          {overview && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile size="sm" label={`${t.present} + ${t.late}`} value={overview.students.present + overview.students.late} tone="emerald" />
              <StatTile size="sm" label={t.absent} value={overview.students.absent} tone="rose" />
              <StatTile size="sm" label={t.leave} value={overview.students.leave} tone="blue" />
              <StatTile size="sm" label={t.unmarked} value={overview.students.unmarked} tone="slate" />
            </div>
          )}

          {/* Class-wise */}
          <Panel title={t.classWise} actions={<span className="text-xs text-slate-400">{t.selectClassHint}</span>}>
            {overviewLoading && !overview ? (
              <SkeletonTable rows={5} />
            ) : classes.length === 0 ? (
              <EmptyRow text={t.noClasses} />
            ) : (
              <div className="-mx-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
                  <thead>
                    <tr>
                      <th className={thClass}>{t.class}</th>
                      <th className={`${thClass} text-end`}>{t.total}</th>
                      <th className={`${thClass} hidden text-end sm:table-cell`}>{t.present}</th>
                      <th className={`${thClass} hidden text-end sm:table-cell`}>{t.late}</th>
                      <th className={`${thClass} text-end`}>{t.absent}</th>
                      <th className={`${thClass} hidden text-end md:table-cell`}>{t.leave}</th>
                      <th className={`${thClass} hidden text-end md:table-cell`}>{t.unmarked}</th>
                      <th className={`${thClass} min-w-[160px]`}>{t.rate}</th>
                      <th className={thClass} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {classes.map((c) => {
                      const active = focus?.id === c.class_id;
                      return (
                        <tr
                          key={c.class_id}
                          onClick={() => setFocus(active ? null : { id: c.class_id, name: c.class_name })}
                          className={`cursor-pointer transition ${
                            active
                              ? "bg-indigo-50 dark:bg-indigo-950/30"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                          }`}
                        >
                          <td className={`${tdClass} font-medium`}>{c.class_name}</td>
                          <td className={`${tdClass} text-end tabular-nums`}>{n(c.total)}</td>
                          <td className={`${tdClass} hidden text-end tabular-nums sm:table-cell`}>{n(c.present)}</td>
                          <td className={`${tdClass} hidden text-end tabular-nums sm:table-cell`}>{n(c.late)}</td>
                          <td className={`${tdClass} text-end tabular-nums text-rose-600 dark:text-rose-400`}>{n(c.absent)}</td>
                          <td className={`${tdClass} hidden text-end tabular-nums md:table-cell`}>{n(c.leave)}</td>
                          <td className={`${tdClass} hidden text-end tabular-nums text-slate-400 md:table-cell`}>{n(c.unmarked)}</td>
                          <td className={tdClass}>
                            <RateBar rate={c.rate} />
                          </td>
                          <td className={`${tdClass} text-end`}>
                            <Link
                              to="/attendance/report"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800"
                              title={t.openReport}
                              aria-label={t.openReport}
                            >
                              <ExternalLink size={15} />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}

      {focus && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-indigo-100 px-3 py-1 font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
            {t.class}: {focus.name}
          </span>
          <button type="button" onClick={() => setFocus(null)} className="text-xs text-slate-500 underline hover:text-slate-700">
            {t.clearClass}
          </button>
        </div>
      )}

      <TrendPanel classId={focus?.id} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <LowAttendancePanel classId={focus?.id} />
        <ConsecutivePanel className={focus?.name} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ trend */

function TrendPanel({ classId }: { classId?: number }) {
  const t = useText(attendanceAnalyticsText).dashboard;
  const lang = useLang();
  const isDark = useThemeStore((s) => s.theme) === "dark";
  const gridColor = isDark ? "#334155" : "#e2e8f0";
  const axisColor = isDark ? "#64748b" : "#94a3b8";

  const [month, setMonth] = useState(currentMonth());
  const [points, setPoints] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setPoints(await analyticsApi.trend({ month, attendee_type: "STUDENT", class_id: classId }, { silent: true }));
    } catch {
      setError(true);
      setPoints([]);
    } finally {
      setLoading(false);
    }
  }, [month, classId]);

  useEffect(() => {
    load();
  }, [load]);

  const data = useMemo(
    () =>
      points
        .filter((p) => !p.off && p.total > 0)
        .map((p) => ({
          ...p,
          day: localizeDigits(String(Number(p.date.slice(8, 10))), lang),
          rate: Number(p.rate) || 0,
        })),
    [points, lang],
  );

  const avg = data.length ? data.reduce((s, p) => s + p.rate, 0) / data.length : 0;

  return (
    <Panel
      title={t.trend}
      actions={
        <>
          {data.length > 0 && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              ~{localizeDigits(formatPercent(Math.round(avg * 10) / 10), lang)}%
            </span>
          )}
          <input
            type="month"
            aria-label={t.month}
            className={`${fieldClass} h-9 w-[150px]`}
            value={month}
            max={currentMonth()}
            onChange={(e) => setMonth(e.target.value || currentMonth())}
          />
        </>
      }
    >
      {loading && points.length === 0 ? (
        <SkeletonChart className="h-56" />
      ) : error ? (
        <EmptyRow text={t.sectionFailed} />
      ) : data.length === 0 ? (
        <EmptyRow text={t.noTrend} />
      ) : (
        <div className={`h-56 ${loading ? "opacity-60" : ""}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barCategoryGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="day" stroke={axisColor} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis
                stroke={axisColor}
                tick={{ fontSize: 11 }}
                width={44}
                domain={[0, 100]}
                tickFormatter={(v: number) => `${localizeDigits(v, lang)}%`}
              />
              <Tooltip
                cursor={{ fill: isDark ? "#1e293b" : "#f1f5f9" }}
                formatter={(_value: unknown, _name: unknown, item: any) => {
                  const p = item?.payload as TrendPoint | undefined;
                  return [
                    t.trendTooltip(
                      localizeDigits(formatPercent(p?.rate ?? 0), lang),
                      formatNumber((p?.present ?? 0) + (p?.late ?? 0), lang),
                      formatNumber(p?.total ?? 0, lang),
                    ),
                    "",
                  ];
                }}
                labelFormatter={(_label: unknown, payload: any) => {
                  const d = payload?.[0]?.payload?.date;
                  return d ? formatDate(d, lang, { weekday: "short", day: "numeric", month: "short" }) : "";
                }}
                contentStyle={{
                  backgroundColor: isDark ? "#1e293b" : "#ffffff",
                  border: `1px solid ${gridColor}`,
                  borderRadius: 12,
                  fontSize: 13,
                }}
                labelStyle={{ color: isDark ? "#e2e8f0" : "#0f172a" }}
              />
              <Bar dataKey="rate" radius={[4, 4, 0, 0]} maxBarSize={22}>
                {data.map((p) => (
                  <Cell key={p.date} fill={p.rate < 75 ? "#f43f5e" : "#6366f1"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

/* --------------------------------------------------------- low attendance */

function LowAttendancePanel({ classId }: { classId?: number }) {
  const t = useText(attendanceAnalyticsText).dashboard;
  const lang = useLang();
  const n = (v: number) => formatNumber(v, lang);

  const [from, setFrom] = useState(monthStartIso());
  const [to, setTo] = useState(localIso());
  const [thresholdInput, setThresholdInput] = useState("");
  const [threshold, setThreshold] = useState<number | undefined>(undefined);
  const [rows, setRows] = useState<LowAttendanceRow[]>([]);
  const [effective, setEffective] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Debounce the threshold box so typing "80" doesn't fire for "8".
  useEffect(() => {
    const id = window.setTimeout(() => {
      const v = Number(thresholdInput);
      setThreshold(thresholdInput.trim() === "" || !Number.isFinite(v) ? undefined : Math.max(0, Math.min(100, v)));
    }, 400);
    return () => window.clearTimeout(id);
  }, [thresholdInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await analyticsApi.lowAttendance(
        { from, to, attendee_type: "STUDENT", class_id: classId, threshold },
        { silent: true },
      );
      setRows(res.rows);
      setEffective(res.threshold);
      if (threshold === undefined && thresholdInput === "" && res.threshold) setThresholdInput(String(res.threshold));
    } catch {
      setError(true);
      setRows([]);
    } finally {
      setLoading(false);
    }
    // thresholdInput only seeds the box once - not a dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, classId, threshold]);

  useEffect(() => {
    load();
  }, [load]);

  const shown = expanded ? rows : rows.slice(0, LOW_PREVIEW);

  return (
    <Panel
      title={t.lowAttendance}
      actions={
        rows.length > 0 ? (
          <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
            {t.lowCount(n(rows.length), localizeDigits(formatPercent(effective), lang))}
          </span>
        ) : null
      }
    >
      <div className="mb-3 grid grid-cols-3 gap-2">
        <Field label={t.from}>
          <input type="date" className={`${fieldClass} h-9 px-2`} value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label={t.to}>
          <input type="date" className={`${fieldClass} h-9 px-2`} value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label={t.threshold}>
          <input
            type="number"
            min={0}
            max={100}
            inputMode="numeric"
            className={`${fieldClass} h-9`}
            value={thresholdInput}
            onChange={(e) => setThresholdInput(e.target.value)}
          />
        </Field>
      </div>

      {loading && rows.length === 0 ? (
        <SkeletonList items={4} />
      ) : error ? (
        <EmptyRow text={t.sectionFailed} />
      ) : rows.length === 0 ? (
        <EmptyRow text={t.lowEmpty} />
      ) : (
        <>
          <ul className={`divide-y divide-slate-100 dark:divide-slate-800 ${loading ? "opacity-60" : ""}`}>
            {shown.map((r) => (
              <li key={r.attendee_id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{r.name}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {[r.class_name, r.roll != null && r.roll !== "" ? `${t.roll}: ${localizeDigits(r.roll, lang)}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                    {r.guardian_phone ? (
                      <>
                        {" · "}
                        <a href={`tel:${r.guardian_phone}`} className="text-indigo-600 hover:underline dark:text-indigo-400">
                          {localizeDigits(r.guardian_phone, lang)}
                        </a>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="w-36 shrink-0">
                  <RateBar rate={r.percentage} low={effective || 75} />
                </div>
              </li>
            ))}
          </ul>
          {rows.length > LOW_PREVIEW && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 w-full rounded-lg py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
            >
              {expanded ? t.showLess : t.showAll(n(rows.length))}
            </button>
          )}
        </>
      )}
    </Panel>
  );
}

/* ---------------------------------------------------- consecutive absence */

function ConsecutivePanel({ className }: { className?: string }) {
  const t = useText(attendanceAnalyticsText).dashboard;
  const lang = useLang();

  const [days, setDays] = useState("");
  const [rows, setRows] = useState<ConsecutiveAbsence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const d = Number(days);
      setRows(await alertsApi.consecutive(days && d >= 2 ? d : undefined, { silent: true }));
    } catch {
      setError(true);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    const id = window.setTimeout(load, days ? 400 : 0);
    return () => window.clearTimeout(id);
  }, [load, days]);

  // The endpoint has no class filter - narrow by the focused class name.
  const visible = useMemo(
    () =>
      (className ? rows.filter((r) => r.class_name === className) : rows)
        .slice()
        .sort((a, b) => b.streak - a.streak),
    [rows, className],
  );

  return (
    <Panel
      title={t.consecutive}
      actions={
        <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          {t.minDays}
          <input
            type="number"
            min={2}
            max={30}
            inputMode="numeric"
            className={`${fieldClass} h-8 w-16 px-2`}
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
        </label>
      }
    >
      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">{t.consecutiveHint}</p>
      {loading && rows.length === 0 ? (
        <SkeletonList items={4} />
      ) : error ? (
        <EmptyRow text={t.sectionFailed} />
      ) : visible.length === 0 ? (
        <EmptyRow text={t.consecutiveEmpty} />
      ) : (
        <ul className={`divide-y divide-slate-100 dark:divide-slate-800 ${loading ? "opacity-60" : ""}`}>
          {visible.map((r) => (
            <li key={r.student_id} className="flex items-center justify-between gap-3 py-2">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
                  <AlertTriangle size={16} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{r.name}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {[
                      r.class_name,
                      r.roll != null && r.roll !== "" ? `${t.roll}: ${localizeDigits(r.roll, lang)}` : null,
                      r.since ? t.since(formatDate(r.since, lang, { day: "numeric", month: "short" })) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                  {t.streak(formatNumber(r.streak, lang))}
                </span>
                {r.guardian_phone && (
                  <a
                    href={`tel:${r.guardian_phone}`}
                    className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
                    title={`${t.call}: ${r.guardian_phone}`}
                    aria-label={`${t.call}: ${r.guardian_phone}`}
                  >
                    <Phone size={16} />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

