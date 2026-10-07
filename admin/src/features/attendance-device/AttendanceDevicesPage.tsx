import { useCallback, useEffect, useState } from "react";
import { Download, KeyRound, Pencil, Plus, Power, RefreshCw, Trash2, Zap } from "lucide-react";

import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import Badge from "@madrasha/shared-ui/src/components/ui/Badge";
import EmptyState from "@madrasha/shared-ui/src/components/ui/EmptyState";
import ErrorState from "@madrasha/shared-ui/src/components/ui/ErrorState";
import { SkeletonList } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import SectionCard from "../../components/settings/SectionCard";
import { attendanceDeviceApi } from "../../services/attendanceDeviceApi";
import { useAuthStore } from "../../store/authStore";
import { hasPermission } from "../../utils/permissions";

import DeviceFormModal from "./DeviceFormModal";
import DeviceKeyModal, { type RevealedKey } from "./DeviceKeyModal";
import { DeviceStatusBadge, TimeAgo } from "./components";
import { CONNECTOR_DOWNLOAD_URL } from "./pairing";
import { useDeviceStatus, useTick } from "./hooks";
import type { AttendanceDevice } from "./types";
import { formatNumber, getText, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { attendanceDeviceText } from "./attendanceDevice.text";

const REFRESH_MS = 15_000;
const TEST_POLL_MS = 4_000;
const TEST_TIMEOUT_MS = 60_000;

/** Compact outlined header-toolbar control (refresh / download). */
const toolbarBtn =
  "inline-flex h-8 items-center rounded-md border border-slate-200 bg-white text-[13px] font-medium shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800";

type TestState = {
  phase: "waiting" | "ok" | "failed" | "timeout";
  startedAt: number;
  /** last_test_at when the test started; a different value means the connector answered. */
  baseTestAt: string | null;
  message?: string;
};

const ts = (value: string | null | undefined) => {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/** Device clock vs connector PC: under a minute counts as in sync (the connector corrects larger drift). */
function ClockDrift({ seconds }: { seconds: number | null | undefined }) {
  const lang = useLang();
  const tx = useText(attendanceDeviceText).devices;
  if (seconds == null || !Number.isFinite(Number(seconds))) {
    return <span className="text-gray-400 dark:text-slate-500">{tx.unknown}</span>;
  }
  const s = Math.round(Number(seconds));
  const abs = formatNumber(Math.abs(s), lang);
  if (Math.abs(s) <= 60) {
    return (
      <span className="text-emerald-600 dark:text-emerald-400">
        {tx.driftOk}
        {s !== 0 && ` (${s > 0 ? "+" : "−"}${abs})`}
      </span>
    );
  }
  return (
    <span className="text-amber-600 dark:text-amber-400">{s > 0 ? tx.driftAhead(abs) : tx.driftBehind(abs)}</span>
  );
}

function UserSyncBadge({ device }: { device: AttendanceDevice }) {
  const tx = useText(attendanceDeviceText).devices;
  if (device.user_sync_error) return <Badge tone="red">{tx.userSyncError}</Badge>;
  if (device.users_in_sync) return <Badge tone="green">{tx.userSyncOk}</Badge>;
  if (device.users_version && device.users_synced_version !== device.users_version) {
    return <Badge tone="yellow">{tx.userSyncPending}</Badge>;
  }
  if (device.users_in_sync === false) return <Badge tone="yellow">{tx.userSyncPending}</Badge>;
  return <span className="text-gray-400 dark:text-slate-500">{tx.unknown}</span>;
}

const iconBtn =
  "rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800";

export default function AttendanceDevicesPage() {
  const lang = useLang();
  const tx = useText(attendanceDeviceText).devices;
  const { devices, setDevices, loading, error, refresh } = useDeviceStatus(REFRESH_MS);
  const now = useTick(15_000);
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const canManage = hasPermission(user, permissions, "attendance_device.manage");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AttendanceDevice | null>(null);
  const [revealed, setRevealed] = useState<RevealedKey | null>(null);
  const [tests, setTests] = useState<Record<number, TestState>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /* ---------- connection test ---------- */

  const waitingCount = Object.values(tests).filter((t) => t.phase === "waiting").length;

  // While any test is pending, poll fast and expire it after ~60s.
  useEffect(() => {
    if (waitingCount === 0) return;
    const timer = setInterval(() => {
      void refresh();
      const at = Date.now();
      setTests((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [id, t] of Object.entries(prev)) {
          if (t.phase === "waiting" && at - t.startedAt >= TEST_TIMEOUT_MS) {
            next[Number(id)] = {
              ...t,
              phase: "timeout",
              message: getText(attendanceDeviceText).devices.testTimeout(formatNumber(TEST_TIMEOUT_MS / 1000, lang)),
            };
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, TEST_POLL_MS);
    return () => clearInterval(timer);
  }, [waitingCount, refresh, lang]);

  // Decide each waiting test from the freshest device data.
  useEffect(() => {
    setTests((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [idStr, t] of Object.entries(prev)) {
        if (t.phase !== "waiting") continue;
        const d = devices.find((x) => x.id === Number(idStr));
        if (!d) continue;

        if (d.last_test_at && d.last_test_at !== t.baseTestAt) {
          next[d.id] = d.last_test_ok
            ? { ...t, phase: "ok", message: getText(attendanceDeviceText).devices.testOk }
            : {
                ...t,
                phase: "failed",
                message: d.last_test_message || d.last_error || getText(attendanceDeviceText).devices.testFailed,
              };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [devices]);

  const startTest = async (device: AttendanceDevice) => {
    const startedAt = Date.now();
    setTests((prev) => ({
      ...prev,
      [device.id]: { phase: "waiting", startedAt, baseTestAt: device.last_test_at ?? null },
    }));
    try {
      await attendanceDeviceApi.requestTest(device.id);
      useToastStore
        .getState()
        .show(tx.testRequested, "info");
      await refresh();
    } catch {
      setTests((prev) => {
        const next = { ...prev };
        delete next[device.id];
        return next;
      });
    }
  };

  /* ---------- actions ---------- */

  const manualRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (device: AttendanceDevice) => {
    setEditing(device);
    setFormOpen(true);
  };

  const toggleActive = async (device: AttendanceDevice) => {
    setBusyId(device.id);
    try {
      await attendanceDeviceApi.update(device.id, { is_active: !device.is_active });
      setDevices((prev) =>
        prev.map((d) => (d.id === device.id ? { ...d, is_active: !d.is_active } : d)),
      );
      useToastStore
        .getState()
        .show(
          device.is_active ? tx.deactivated : tx.activated,
          "success",
        );
    } catch {
      // interceptor toast
    } finally {
      setBusyId(null);
    }
  };

  const confirmRotate = (device: AttendanceDevice) => {
    useConfirmStore.getState().show({
      title: tx.rotateTitle,
      message: tx.rotateMessage(device.name),
      confirmText: tx.rotateConfirm,
      danger: true,
      onConfirm: async () => {
        try {
          const { raw_key } = await attendanceDeviceApi.rotateKey(device.id);
          setRevealed({
            deviceCode: device.device_id,
            deviceName: device.name,
            rawKey: raw_key,
            rotated: true,
          });
        } catch {
          // interceptor toast
        }
      },
    });
  };

  const confirmDelete = (device: AttendanceDevice) => {
    useConfirmStore.getState().show({
      title: tx.deleteTitle,
      message: tx.deleteMessage(device.name),
      confirmText: tx.deleteConfirm,
      danger: true,
      onConfirm: async () => {
        try {
          await attendanceDeviceApi.remove(device.id);
          setDevices((prev) => prev.filter((d) => d.id !== device.id));
          useToastStore.getState().show(tx.deleted, "success");
        } catch {
          // interceptor toast
        }
      },
    });
  };

  const onFormClose = useCallback(() => setFormOpen(false), []);

  /* ---------- render ---------- */

  const renderTest = (device: AttendanceDevice) => {
    const t = tests[device.id];
    if (!t) return null;
    const tone =
      t.phase === "ok"
        ? "text-emerald-600 dark:text-emerald-400"
        : t.phase === "waiting"
          ? "text-blue-600 dark:text-blue-400"
          : "text-rose-600 dark:text-rose-400";
    return (
      <p className={`mt-2 flex items-start gap-1.5 text-xs font-medium ${tone}`}>
        {t.phase === "waiting" && <RefreshCw size={12} className="mt-0.5 shrink-0 animate-spin" />}
        <span>
          {t.phase === "waiting"
            ? tx.testing(formatNumber(TEST_TIMEOUT_MS / 1000, lang))
            : t.message}
        </span>
      </p>
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={tx.title}
        subtitle={tx.subtitle}
        actions={
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={manualRefresh}
              disabled={refreshing}
              title={tx.refresh}
              aria-label={tx.refresh}
              className={`${toolbarBtn} w-8 justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100`}
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            </button>
            <a
              href={CONNECTOR_DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              title={tx.downloadConnectorHint}
              aria-label={tx.downloadConnector}
              className={`${toolbarBtn} gap-1.5 px-2.5 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white`}
            >
              <Download size={14} />
              <span className="hidden sm:inline">{tx.downloadConnector}</span>
            </a>
            {canManage && (
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex h-8 items-center gap-1 rounded-md bg-indigo-600 pl-2 pr-3 text-[13px] font-medium text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
              >
                <Plus size={15} />
                {tx.newDevice}
              </button>
            )}
          </div>
        }
      />

      <SectionCard title={tx.allDevices} hint={tx.autoUpdateHint(formatNumber(REFRESH_MS / 1000, lang))}>
        {loading ? (
          <SkeletonList items={3} />
        ) : error && devices.length === 0 ? (
          <ErrorState
            title={tx.listLoadFailed}
            message={tx.checkInternet}
            onRetry={manualRefresh}
            retryText={tx.retry}
          />
        ) : devices.length === 0 ? (
          <EmptyState
            title={tx.emptyTitle}
            hint={`${tx.emptyHint} ${tx.emptyConnectorHint}`}
            action={
              <a
                href={CONNECTOR_DOWNLOAD_URL}
                target="_blank"
                rel="noopener noreferrer"
                title={tx.downloadConnectorHint}
                className={`${toolbarBtn} gap-1.5 px-3 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white`}
              >
                <Download size={15} />
                {tx.downloadConnector}
              </a>
            }
          />
        ) : (
          <div className="space-y-3">
            {devices.map((device) => {
              const test = tests[device.id];
              return (
                <div
                  key={device.id}
                  className="rounded-xl border border-gray-100 p-4 dark:border-slate-800"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-gray-900 dark:text-slate-100">
                          {device.name}
                        </span>
                        <DeviceStatusBadge status={device.status} inactive={!device.is_active} />
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {tx.id(device.device_id)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                        {device.ip}:{device.port} ·{" "}
                        {tx.polling(formatNumber(device.poll_interval_sec, lang))}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-1">
                      {canManage && (
                        <>
                          <Button
                            variant="secondary"
                            className="gap-1.5 px-3 py-1.5 text-xs"
                            onClick={() => startTest(device)}
                            disabled={test?.phase === "waiting"}
                          >
                            <Zap size={13} />
                            {tx.connectionTest}
                          </Button>
                          <button
                            type="button"
                            className={iconBtn}
                            title={tx.edit}
                            onClick={() => openEdit(device)}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className={iconBtn}
                            title={tx.rotateKey}
                            onClick={() => confirmRotate(device)}
                          >
                            <KeyRound size={14} />
                          </button>
                          <button
                            type="button"
                            className={`${iconBtn} ${device.is_active ? "!text-amber-500" : "!text-green-600"}`}
                            title={device.is_active ? tx.deactivate : tx.activate}
                            disabled={busyId === device.id}
                            onClick={() => toggleActive(device)}
                          >
                            <Power size={14} />
                          </button>
                          <button
                            type="button"
                            className={`${iconBtn} hover:!bg-red-50 hover:!text-red-600 dark:hover:!bg-red-950/40`}
                            title={tx.delete}
                            onClick={() => confirmDelete(device)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
                    <div>
                      <dt className="text-gray-400 dark:text-slate-500">
                        {tx.connectorLastContact}
                      </dt>
                      <dd className="font-medium text-gray-700 dark:text-slate-200">
                        <TimeAgo
                          value={device.last_seen_at}
                          now={now}
                          fallback={tx.neverConnected}
                        />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-400 dark:text-slate-500">{tx.deviceLastContact}</dt>
                      <dd className="font-medium text-gray-700 dark:text-slate-200">
                        <TimeAgo value={device.last_device_contact_at} now={now} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-400 dark:text-slate-500">{tx.lastSync}</dt>
                      <dd className="font-medium text-gray-700 dark:text-slate-200">
                        <TimeAgo value={device.last_sync_at} now={now} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-400 dark:text-slate-500">{tx.clockDrift}</dt>
                      <dd className="font-medium text-gray-700 dark:text-slate-200">
                        <ClockDrift seconds={device.clock_drift_sec} />
                      </dd>
                    </div>
                    {device.queue_pending != null && (
                      <div>
                        <dt className="text-gray-400 dark:text-slate-500">{tx.queue}</dt>
                        <dd
                          className={`font-medium ${
                            device.queue_pending > 0 ? "text-amber-600 dark:text-amber-400" : "text-gray-700 dark:text-slate-200"
                          }`}
                        >
                          {device.queue_pending > 0
                            ? tx.queuePending(formatNumber(device.queue_pending, lang))
                            : tx.queueEmpty}
                        </dd>
                      </div>
                    )}
                    <div className="sm:col-span-2">
                      <dt className="text-gray-400 dark:text-slate-500">{tx.userSync}</dt>
                      <dd className="flex flex-wrap items-center gap-2 font-medium text-gray-700 dark:text-slate-200">
                        <UserSyncBadge device={device} />
                        {device.device_user_count != null && (
                          <span>{tx.deviceUsers(formatNumber(device.device_user_count, lang))}</span>
                        )}
                        {device.last_user_sync_at && (
                          <span className="text-gray-400 dark:text-slate-500">
                            · <TimeAgo value={device.last_user_sync_at} now={now} />
                          </span>
                        )}
                      </dd>
                    </div>
                  </dl>

                  {device.user_sync_error && (
                    <p className="mt-2 break-words rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                      {tx.userSyncErrorMsg(device.user_sync_error)}
                    </p>
                  )}
                  {device.offline_alerted_at && device.status !== "online" && (
                    <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">
                      {tx.offlineAlerted} · <TimeAgo value={device.offline_alerted_at} now={now} />
                    </p>
                  )}

                  {device.last_error && (
                    <p className="mt-2 break-words rounded-lg bg-rose-50 px-3 py-1.5 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-400">
                      {tx.lastError(device.last_error)}
                    </p>
                  )}

                  {renderTest(device)}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <DeviceFormModal
        open={formOpen}
        device={editing}
        onClose={onFormClose}
        onCreated={(created) => {
          setFormOpen(false);
          const { raw_key, ...device } = created;
          setDevices((prev) => [...prev.filter((d) => d.id !== device.id), device]);
          setRevealed({
            deviceCode: device.device_id,
            deviceName: device.name,
            rawKey: raw_key,
            rotated: false,
          });
          void refresh();
        }}
        onUpdated={(updated) => {
          setFormOpen(false);
          setDevices((prev) => prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
          void refresh();
        }}
      />

      <DeviceKeyModal revealed={revealed} onClose={() => setRevealed(null)} />
    </div>
  );
}
