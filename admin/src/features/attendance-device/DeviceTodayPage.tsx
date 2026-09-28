import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Clock, Fingerprint, RefreshCw, UserCheck } from "lucide-react";

import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import Input from "@madrasha/shared-ui/src/components/ui/Input";
import StatTile from "@madrasha/shared-ui/src/components/ui/StatTile";
import EmptyState from "@madrasha/shared-ui/src/components/ui/EmptyState";
import ErrorState from "@madrasha/shared-ui/src/components/ui/ErrorState";
import { SkeletonList } from "@madrasha/shared-ui/src/components/ui/Skeleton";
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
import type { TodayReport } from "./types";
import { formatDateTime, formatTime, relativeTime, toBnNumber, todayIso } from "./utils";
import { useText } from "@madrasha/shared-ui/src/i18n";
import { attendanceDeviceText } from "./attendanceDevice.text";

const REFRESH_MS = 30_000;

export default function DeviceTodayPage() {
  const t = useText(attendanceDeviceText).today;
  const now = useTick(30_000);
  const { devices, loading: devicesLoading, error: devicesError } = useDeviceStatus(REFRESH_MS);

  const [date, setDate] = useState(todayIso);
  const [deviceId, setDeviceId] = useState("");

  const [report, setReport] = useState<TodayReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const data = await attendanceDeviceApi.getToday(
        { date: date || undefined, device_id: deviceId || undefined },
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
  }, [date, deviceId]);

  useEffect(() => {
    void load();
  }, [load]);

  useVisibleInterval(load, REFRESH_MS);

  const rows = report?.rows ?? [];
  const summary = report?.summary;
  const isToday = date === todayIso();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={t.title}
        subtitle={t.subtitle(toBnNumber(REFRESH_MS / 1000))}
        actions={
          <Button variant="secondary" onClick={load} disabled={loading} className="gap-1.5">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            {t.refresh}
          </Button>
        }
      />

      <DeviceStatusStrip
        devices={devices}
        now={now}
        loading={devicesLoading}
        error={devicesError}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          size="sm"
          tone="emerald"
          label={t.present}
          value={summary?.present ?? 0}
          loading={loading && !report}
          icon={<UserCheck size={18} />}
        />
        <StatTile
          size="sm"
          tone="amber"
          label={t.unmapped}
          value={summary?.unmapped ?? 0}
          subLabel={summary?.unmapped ? t.unmappedHint : undefined}
          loading={loading && !report}
          icon={<AlertTriangle size={18} />}
          to="/attendance/device-mapping"
        />
        <StatTile
          size="sm"
          tone="indigo"
          label={t.totalPunches}
          value={summary?.total_punches ?? 0}
          loading={loading && !report}
          icon={<Fingerprint size={18} />}
        />
        <StatTile
          size="sm"
          tone="slate"
          label={t.lastSync}
          value={summary?.last_sync_at ? relativeTime(summary.last_sync_at, now) : "—"}
          subLabel={summary?.last_sync_at ? formatDateTime(summary.last_sync_at) : undefined}
          loading={loading && !report}
          icon={<Clock size={18} />}
        />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="sm:w-48">
            <label className={inputLabelClass}>{t.date}</label>
            <Input
              type="date"
              value={date}
              max={todayIso()}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="sm:w-60">
            <label className={inputLabelClass}>{t.device}</label>
            <select
              className={selectClass}
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
            >
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

        {loading && !report ? (
          <SkeletonList items={6} />
        ) : error && !report ? (
          <ErrorState
            title={t.loadFailed}
            message={t.tryAgainDot}
            onRetry={load}
            retryText={t.retry}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title={isToday ? t.noPunchToday : t.noAttendance}
            hint={t.emptyHint}
          />
        ) : (
          <>
            {error && (
              <p className="mb-2 text-xs text-amber-600 dark:text-amber-400">
                {t.refreshFailed}
              </p>
            )}
            <div className={`overflow-x-auto ${loading ? "opacity-60 transition" : "transition"}`}>
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-start text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <th className="py-2 pe-3 font-medium">{t.student}</th>
                    <th className="py-2 pe-3 font-medium">{t.id}</th>
                    <th className="py-2 pe-3 font-medium">{t.class}</th>
                    <th className="py-2 pe-3 font-medium">{t.checkIn}</th>
                    <th className="py-2 pe-3 font-medium">{t.device}</th>
                    <th className="py-2 pe-3 font-medium">{t.sync}</th>
                    <th className="py-2 pe-3 font-medium">{t.sms}</th>
                    <th className="py-2 font-medium">{t.syncTime}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={`${r.student_id}-${r.check_in_at ?? i}`}
                      className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                    >
                      <td className="py-2.5 pe-3 font-medium text-slate-900 dark:text-slate-100">
                        {r.name_bn}
                      </td>
                      <td className="py-2.5 pe-3 text-slate-600 dark:text-slate-300">
                        {r.student_id}
                      </td>
                      <td className="py-2.5 pe-3 text-slate-700 dark:text-slate-300">
                        {r.class_name || "—"}
                      </td>
                      <td
                        className="py-2.5 pe-3 font-semibold tabular-nums text-slate-900 dark:text-slate-100"
                        title={formatDateTime(r.check_in_at)}
                      >
                        {formatTime(r.check_in_at)}
                      </td>
                      <td className="py-2.5 pe-3 text-slate-700 dark:text-slate-300">
                        {r.device_name || "—"}
                      </td>
                      <td className="py-2.5 pe-3">
                        <SyncStatusBadge status={r.sync_status} />
                      </td>
                      <td className="py-2.5 pe-3">
                        <SmsStatusBadge status={r.sms_status} />
                      </td>
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
    </div>
  );
}
