import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Briefcase,
  CalendarOff,
  Clock,
  Download,
  Fingerprint,
  GraduationCap,
  LogOut,
  RefreshCw,
  Timer,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";

import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import Input from "@madrasha/shared-ui/src/components/ui/Input";
import StatTile from "@madrasha/shared-ui/src/components/ui/StatTile";
import EmptyState from "@madrasha/shared-ui/src/components/ui/EmptyState";
import ErrorState from "@madrasha/shared-ui/src/components/ui/ErrorState";
import Badge, { type BadgeTone } from "@madrasha/shared-ui/src/components/ui/Badge";
import { SkeletonList } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { getText, localizeDigits, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { attendanceDeviceApi } from "../../services/attendanceDeviceApi";

import {
  DeviceStatusStrip,
  SmsStatusBadge,
  SyncStatusBadge,
  TimeAgo,
  inputLabelClass,
  selectClass,
} from "./components";
import { useDeviceStatus, useTick, useVisibleInterval } from "./hooks";
import { ATTENDEE_TYPES, type AttendeeType, type DayStatus, type TodayReport } from "./types";
import { formatDateTime, formatTime, relativeTime, toBnNumber, todayIso } from "./utils";
import { attendanceDeviceText } from "./attendanceDevice.text";

const REFRESH_MS = 30_000;
const NOT_ARRIVED_PREVIEW = 60;
const TAB_ICONS: Record<AttendeeType, typeof Users> = { STUDENT: GraduationCap, TEACHER: Users, STAFF: Briefcase };

const STATUS_TONE: Record<DayStatus, BadgeTone> = {
  PRESENT: "green",
  LATE: "yellow",
  ABSENT: "red",
  LEAVE: "blue",
};

function DayStatusBadge({ status }: { status: DayStatus | null | undefined }) {
  const t = useText(attendanceDeviceText).today.statusLabels;
  if (!status || !STATUS_TONE[status]) return <span className="text-slate-400">—</span>;
  return <Badge tone={STATUS_TONE[status]}>{t[status]}</Badge>;
}

/* ---------------- CSV (client side, UTF-8 BOM so Excel shows Bangla) ---------------- */

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function downloadCsv(report: TodayReport, date: string) {
  const t = getText(attendanceDeviceText).today;
  const isStudents = report.attendee_type === "STUDENT";
  const header = [
    t.csvName,
    t.csvDeviceId,
    ...(isStudents ? [t.csvClass, t.csvRoll] : []),
    t.csvStatus,
    t.csvCheckIn,
    t.csvCheckOut,
    t.csvDevice,
  ];
  const lines: unknown[][] = [header];
  const time = (v: string | null) => (v ? formatTime(v, "") : "");

  for (const r of report.rows) {
    lines.push([
      r.name_bn,
      r.device_user_id ?? "",
      ...(isStudents ? [r.class_name ?? "", r.roll ?? ""] : []),
      r.status ? t.statusLabels[r.status] : "",
      time(r.check_in_at),
      time(r.check_out_at),
      r.device_name ?? "",
    ]);
  }
  for (const p of report.not_arrived) {
    lines.push([
      p.name,
      "",
      ...(isStudents ? [p.class_name ?? "", p.roll ?? ""] : []),
      p.status ? t.statusLabels[p.status] : t.csvNoPunch,
      "",
      "",
      "",
    ]);
  }

  const csv = "﻿" + lines.map((l) => l.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `device-attendance-${report.attendee_type.toLowerCase()}-${date || todayIso()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------------- page ---------------- */

export default function DeviceTodayPage() {
  const t = useText(attendanceDeviceText).today;
  const lang = useLang();
  const now = useTick(30_000);
  const { devices, loading: devicesLoading, error: devicesError } = useDeviceStatus(REFRESH_MS);

  const [date, setDate] = useState(todayIso);
  const [deviceId, setDeviceId] = useState("");
  const [type, setType] = useState<AttendeeType>("STUDENT");

  const [report, setReport] = useState<TodayReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [showAllMissing, setShowAllMissing] = useState(false);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const data = await attendanceDeviceApi.getToday(
        { date: date || undefined, device_id: deviceId || undefined, attendee_type: type },
        { silent: true },
      );
      if (id !== reqId.current) return;
      setReport(data);
      setError(false);
      setUpdatedAt(Date.now());
    } catch {
      if (id === reqId.current) setError(true);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [date, deviceId, type]);

  useEffect(() => {
    void load();
  }, [load]);

  useVisibleInterval(load, REFRESH_MS);

  // A different tab/date shows a different report - don't flash the old one.
  useEffect(() => {
    setReport(null);
    setShowAllMissing(false);
  }, [type, date]);

  const rows = report?.rows ?? [];
  const summary = report?.summary;
  const isToday = date === todayIso();
  const isStudents = type === "STUDENT";
  const tilesLoading = loading && !report;
  const notArrived = report?.not_arrived ?? [];
  const classes = report?.classes ?? [];
  const mappedTotal = summary?.mapped_total ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={t.title}
        subtitle={t.subtitle(toBnNumber(REFRESH_MS / 1000))}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => report && downloadCsv(report, date)}
              disabled={!report || (rows.length === 0 && notArrived.length === 0)}
              className="gap-1.5"
            >
              <Download size={15} />
              {t.exportCsv}
            </Button>
            <Button variant="secondary" onClick={load} disabled={loading} className="gap-1.5">
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              {t.refresh}
            </Button>
          </>
        }
      />

      <DeviceStatusStrip devices={devices} now={now} loading={devicesLoading} error={devicesError} />

      {/* Attendee type tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900 sm:inline-flex">
        {ATTENDEE_TYPES.map((tp) => {
          const Icon = TAB_ICONS[tp];
          return (
            <button
              key={tp}
              type="button"
              onClick={() => setType(tp)}
              className={`inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition ${
                type === tp
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="h-4 w-4" /> {t.tabs[tp]}
            </button>
          );
        })}
      </div>

      {report?.is_holiday && (
        <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300">
          <CalendarOff className="mt-0.5 h-5 w-5 shrink-0" />
          <span className="font-medium">
            {report.holiday_title ? t.holiday(report.holiday_title) : t.holidayWeekly}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          size="sm"
          tone="emerald"
          label={t.present}
          value={summary?.present ?? 0}
          subLabel={mappedTotal ? t.ofMapped(toBnNumber(mappedTotal)) : undefined}
          loading={tilesLoading}
          icon={<UserCheck size={18} />}
        />
        <StatTile
          size="sm"
          tone="amber"
          label={t.late}
          value={summary?.late ?? 0}
          loading={tilesLoading}
          icon={<Timer size={18} />}
        />
        <StatTile
          size="sm"
          tone="rose"
          label={t.absent}
          value={summary?.absent ?? 0}
          loading={tilesLoading}
          icon={<UserX size={18} />}
        />
        <StatTile
          size="sm"
          tone="slate"
          label={t.notArrived}
          value={summary?.not_arrived ?? 0}
          loading={tilesLoading}
          icon={<Users size={18} />}
        />
        <StatTile
          size="sm"
          tone="indigo"
          label={t.checkedOut}
          value={summary?.checked_out ?? 0}
          loading={tilesLoading}
          icon={<LogOut size={18} />}
        />
        <StatTile
          size="sm"
          tone="amber"
          label={t.unmapped}
          value={summary?.unmapped ?? 0}
          subLabel={summary?.unmapped ? t.unmappedHint : undefined}
          loading={tilesLoading}
          icon={<AlertTriangle size={18} />}
          to="/attendance/device-mapping"
        />
        <StatTile
          size="sm"
          tone="blue"
          label={t.totalPunches}
          value={summary?.total_punches ?? 0}
          subLabel={summary?.rejected_punches ? t.rejected(toBnNumber(summary.rejected_punches)) : undefined}
          loading={tilesLoading}
          icon={<Fingerprint size={18} />}
        />
        <StatTile
          size="sm"
          tone="slate"
          label={t.lastSync}
          value={summary?.last_sync_at ? relativeTime(summary.last_sync_at, now) : "—"}
          subLabel={summary?.last_sync_at ? formatDateTime(summary.last_sync_at) : undefined}
          loading={tilesLoading}
          icon={<Clock size={18} />}
        />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="sm:w-48">
            <label className={inputLabelClass}>{t.date}</label>
            <Input type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="sm:w-60">
            <label className={inputLabelClass}>{t.device}</label>
            <select className={selectClass} value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
              <option value="">{t.allDevices}</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          {!isToday && (
            <Button variant="ghost" className="text-xs" onClick={() => setDate(todayIso())}>
              {t.backToToday}
            </Button>
          )}
          <p className="text-xs text-slate-400 sm:ms-auto">
            {updatedAt ? t.lastUpdate(formatTime(new Date(updatedAt).toISOString())) : ""}
          </p>
        </div>

        <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{t.punchesTitle}</h2>

        {loading && !report ? (
          <SkeletonList items={6} />
        ) : error && !report ? (
          <ErrorState title={t.loadFailed} message={t.tryAgainDot} onRetry={load} retryText={t.retry} />
        ) : rows.length === 0 ? (
          <EmptyState title={isToday ? t.noPunchToday : t.noAttendance} hint={t.emptyHint} />
        ) : (
          <>
            {error && <p className="mb-2 text-xs text-amber-600 dark:text-amber-400">{t.refreshFailed}</p>}
            <div className={`overflow-x-auto ${loading ? "opacity-60 transition" : "transition"}`}>
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-start text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <th className="py-2 pe-3 font-medium">{t.nameCol[type]}</th>
                    {isStudents && <th className="py-2 pe-3 font-medium">{t.class}</th>}
                    <th className="py-2 pe-3 font-medium">{t.status}</th>
                    <th className="py-2 pe-3 font-medium">{t.checkIn}</th>
                    <th className="py-2 pe-3 font-medium">{t.checkOut}</th>
                    <th className="py-2 pe-3 font-medium">{t.device}</th>
                    <th className="py-2 pe-3 font-medium">{t.sync}</th>
                    {isStudents && <th className="py-2 pe-3 font-medium">{t.sms}</th>}
                    <th className="py-2 font-medium">{t.syncTime}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={`${r.attendee_id ?? `u${r.device_user_id}`}-${r.check_in_at ?? i}`}
                      className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                    >
                      <td className="py-2.5 pe-3">
                        <div
                          className={`font-medium ${r.mapped ? "text-slate-900 dark:text-slate-100" : "text-amber-700 dark:text-amber-400"}`}
                        >
                          {r.name_bn}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {r.device_user_id != null && t.pin(localizeDigits(String(r.device_user_id), lang))}
                          {isStudents && r.roll != null && r.roll !== "" && ` · ${t.rollShort(String(r.roll))}`}
                          {r.punch_count > 1 && ` · ${t.punchCount(toBnNumber(r.punch_count))}`}
                        </div>
                      </td>
                      {isStudents && (
                        <td className="py-2.5 pe-3 text-slate-700 dark:text-slate-300">{r.class_name || "—"}</td>
                      )}
                      <td className="py-2.5 pe-3">
                        <DayStatusBadge status={r.status} />
                      </td>
                      <td
                        className="py-2.5 pe-3 font-semibold tabular-nums text-slate-900 dark:text-slate-100"
                        title={formatDateTime(r.check_in_at)}
                      >
                        {formatTime(r.check_in_at)}
                      </td>
                      <td
                        className="py-2.5 pe-3 tabular-nums text-slate-700 dark:text-slate-300"
                        title={r.check_out_at ? formatDateTime(r.check_out_at) : undefined}
                      >
                        {formatTime(r.check_out_at)}
                      </td>
                      <td className="py-2.5 pe-3 text-slate-700 dark:text-slate-300">{r.device_name || "—"}</td>
                      <td className="py-2.5 pe-3">
                        <SyncStatusBadge status={r.sync_status} />
                      </td>
                      {isStudents && (
                        <td className="py-2.5 pe-3">
                          <SmsStatusBadge status={r.sms_status} />
                        </td>
                      )}
                      <td className="py-2.5 text-xs text-slate-500 dark:text-slate-400">
                        <TimeAgo value={r.received_at} now={now} fallback="—" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Not arrived yet */}
      {report && !report.is_holiday && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t.notArrivedTitle}</h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t.notArrivedHint}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {toBnNumber(notArrived.length)}
            </span>
          </div>
          {notArrived.length === 0 ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">{t.allArrived}</p>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(showAllMissing ? notArrived : notArrived.slice(0, NOT_ARRIVED_PREVIEW)).map((p) => (
                  <div
                    key={p.attendee_id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2 dark:border-slate-800"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{p.name}</div>
                      {isStudents && (
                        <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                          {p.class_name || "—"}
                          {p.roll != null && p.roll !== "" && ` · ${t.rollShort(String(p.roll))}`}
                        </div>
                      )}
                    </div>
                    {p.status && <DayStatusBadge status={p.status} />}
                  </div>
                ))}
              </div>
              {notArrived.length > NOT_ARRIVED_PREVIEW && (
                <button
                  type="button"
                  onClick={() => setShowAllMissing((v) => !v)}
                  className="mt-3 text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  {showAllMissing ? t.showLess : t.showAll(toBnNumber(notArrived.length))}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Class-wise summary (students) */}
      {isStudents && classes.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{t.classTitle}</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-start text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="py-2 pe-3 font-medium">{t.classCol}</th>
                  <th className="py-2 pe-3 text-end font-medium">{t.mappedCol}</th>
                  <th className="py-2 pe-3 text-end font-medium">{t.presentCol}</th>
                  <th className="py-2 pe-3 text-end font-medium">{t.lateCol}</th>
                  <th className="py-2 pe-3 text-end font-medium">{t.absentCol}</th>
                  <th className="py-2 pe-3 text-end font-medium">{t.notArrivedCol}</th>
                  <th className="py-2 font-medium">{t.rateCol}</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((cl) => {
                  const came = cl.present + cl.late;
                  const missing = Math.max(0, cl.mapped_total - came - cl.absent);
                  const rate = cl.mapped_total ? Math.round((came / cl.mapped_total) * 100) : 0;
                  return (
                    <tr key={cl.class_id ?? "none"} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                      <td className="py-2.5 pe-3 font-medium text-slate-900 dark:text-slate-100">
                        {cl.class_name || t.noClass}
                      </td>
                      <td className="py-2.5 pe-3 text-end tabular-nums">{toBnNumber(cl.mapped_total)}</td>
                      <td className="py-2.5 pe-3 text-end tabular-nums text-emerald-700 dark:text-emerald-400">
                        {toBnNumber(cl.present)}
                      </td>
                      <td className="py-2.5 pe-3 text-end tabular-nums text-amber-700 dark:text-amber-400">
                        {toBnNumber(cl.late)}
                      </td>
                      <td className="py-2.5 pe-3 text-end tabular-nums text-rose-700 dark:text-rose-400">
                        {toBnNumber(cl.absent)}
                      </td>
                      <td className="py-2.5 pe-3 text-end tabular-nums text-slate-600 dark:text-slate-300">
                        {toBnNumber(missing)}
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${rate}%` }} />
                          </div>
                          <span className="text-xs tabular-nums text-slate-600 dark:text-slate-300">
                            {toBnNumber(rate)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
