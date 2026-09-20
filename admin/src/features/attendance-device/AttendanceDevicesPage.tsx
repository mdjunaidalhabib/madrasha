import { useCallback, useEffect, useState } from "react";
import { KeyRound, Pencil, Plus, Power, RefreshCw, Trash2, Zap } from "lucide-react";

import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
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
import { useDeviceStatus, useTick } from "./hooks";
import type { AttendanceDevice } from "./types";

const REFRESH_MS = 15_000;
const TEST_POLL_MS = 4_000;
const TEST_TIMEOUT_MS = 60_000;

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

const iconBtn =
  "rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800";

export default function AttendanceDevicesPage() {
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
              message: "৬০ সেকেন্ডে কোনো সাড়া মেলেনি - কানেক্টর চালু আছে কিনা দেখুন",
            };
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, TEST_POLL_MS);
    return () => clearInterval(timer);
  }, [waitingCount, refresh]);

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
            ? { ...t, phase: "ok", message: "ডিভাইসের সাথে সংযোগ সফল হয়েছে" }
            : {
                ...t,
                phase: "failed",
                message: d.last_test_message || d.last_error || "ডিভাইসের সাথে সংযোগ হয়নি",
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
        .show("টেস্ট অনুরোধ পাঠানো হয়েছে, কানেক্টরের সাড়ার অপেক্ষা...", "info");
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
          device.is_active ? "ডিভাইস নিষ্ক্রিয় করা হয়েছে" : "ডিভাইস সক্রিয় করা হয়েছে",
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
      title: "কানেক্টর কী পরিবর্তন করুন",
      message: `"${device.name}" ডিভাইসের নতুন কী তৈরি হবে। পুরনো কী সাথে সাথে অচল হয়ে যাবে, কানেক্টরে নতুন কী বসাতে হবে।`,
      confirmText: "নতুন কী তৈরি করুন",
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
      title: "ডিভাইস ডিলিট করুন",
      message: `"${device.name}" ডিভাইসটি মুছে ফেলতে চান? কানেক্টর আর এই ডিভাইসের হয়ে ডেটা পাঠাতে পারবে না।`,
      confirmText: "ডিলিট করুন",
      danger: true,
      onConfirm: async () => {
        try {
          await attendanceDeviceApi.remove(device.id);
          setDevices((prev) => prev.filter((d) => d.id !== device.id));
          useToastStore.getState().show("ডিভাইস মুছে ফেলা হয়েছে", "success");
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
            ? "টেস্ট চলছে - কানেক্টরের সাড়ার অপেক্ষা (সর্বোচ্চ ৬০ সেকেন্ড)..."
            : t.message}
        </span>
      </p>
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="উপস্থিতি ডিভাইস"
        subtitle="ZKTeco K40 ডিভাইস যোগ করুন ও অবস্থা দেখুন। ডিভাইসের কাছাকাছি চলা কানেক্টর প্রোগ্রাম এই তালিকা থেকে সংযোগের তথ্য নেয়।"
        actions={
          <>
            <Button
              variant="secondary"
              onClick={manualRefresh}
              disabled={refreshing}
              className="gap-1.5"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
              রিফ্রেশ
            </Button>
            {canManage && (
              <Button onClick={openCreate} className="gap-1.5">
                <Plus size={15} />
                নতুন ডিভাইস
              </Button>
            )}
          </>
        }
      />

      <SectionCard title="সব ডিভাইস" hint="প্রতি ১৫ সেকেন্ডে অবস্থা নিজে থেকে আপডেট হয়">
        {loading ? (
          <SkeletonList items={3} />
        ) : error && devices.length === 0 ? (
          <ErrorState
            title="ডিভাইস তালিকা লোড করা যায়নি"
            message="ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।"
            onRetry={manualRefresh}
            retryText="আবার চেষ্টা করুন"
          />
        ) : devices.length === 0 ? (
          <EmptyState
            title="এখনো কোনো ডিভাইস যোগ করা হয়নি"
            hint="K40 ডিভাইসের আইপি ও পোর্ট দিয়ে প্রথম ডিভাইসটি যোগ করুন।"
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
                          আইডি: {device.device_id}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                        {device.ip}:{device.port} · পোলিং প্রতি{" "}
                        {device.poll_interval_sec.toLocaleString("bn-BD")} সেকেন্ড
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
                            কানেকশন টেস্ট
                          </Button>
                          <button
                            type="button"
                            className={iconBtn}
                            title="সম্পাদনা"
                            onClick={() => openEdit(device)}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className={iconBtn}
                            title="কী পরিবর্তন"
                            onClick={() => confirmRotate(device)}
                          >
                            <KeyRound size={14} />
                          </button>
                          <button
                            type="button"
                            className={`${iconBtn} ${device.is_active ? "!text-amber-500" : "!text-green-600"}`}
                            title={device.is_active ? "নিষ্ক্রিয় করুন" : "সক্রিয় করুন"}
                            disabled={busyId === device.id}
                            onClick={() => toggleActive(device)}
                          >
                            <Power size={14} />
                          </button>
                          <button
                            type="button"
                            className={`${iconBtn} hover:!bg-red-50 hover:!text-red-600 dark:hover:!bg-red-950/40`}
                            title="মুছুন"
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
                        কানেক্টর সর্বশেষ যোগাযোগ
                      </dt>
                      <dd className="font-medium text-gray-700 dark:text-slate-200">
                        <TimeAgo
                          value={device.last_seen_at}
                          now={now}
                          fallback="কখনো সংযুক্ত হয়নি"
                        />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-400 dark:text-slate-500">ডিভাইসে সর্বশেষ সংযোগ</dt>
                      <dd className="font-medium text-gray-700 dark:text-slate-200">
                        <TimeAgo value={device.last_device_contact_at} now={now} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-400 dark:text-slate-500">সর্বশেষ সিঙ্ক</dt>
                      <dd className="font-medium text-gray-700 dark:text-slate-200">
                        <TimeAgo value={device.last_sync_at} now={now} />
                      </dd>
                    </div>
                  </dl>

                  {device.last_error && (
                    <p className="mt-2 break-words rounded-lg bg-rose-50 px-3 py-1.5 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-400">
                      সর্বশেষ ত্রুটি: {device.last_error}
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
