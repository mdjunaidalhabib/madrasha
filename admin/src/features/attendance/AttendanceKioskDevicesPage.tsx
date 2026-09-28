import { useCallback, useEffect, useState } from "react";
import { Copy, Plus, Power, Trash2 } from "lucide-react";

import { kioskDeviceApi, type KioskDevice } from "../../services/phase1Api";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import { getTenantSlugFromPath } from "../../utils/tenantSlug";
import { getPublicSiteKioskUrl } from "../../utils/publicSiteUrl";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { SkeletonList } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import EmptyState from "@madrasha/shared-ui/src/components/ui/EmptyState";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import Input from "@madrasha/shared-ui/src/components/ui/Input";
import SectionCard from "../../components/settings/SectionCard";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import { commonText, formatDateTime as formatDateTimeL, getLang, getText, useText } from "@madrasha/shared-ui/src/i18n";
import { attendanceText } from "./attendance.text";

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

const formatDateTime = (value: string | null) => {
  if (!value) return null;
  try {
    return formatDateTimeL(value, getLang(), {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
};

export default function AttendanceKioskDevicesPage() {
  const t = useText(attendanceText).kiosk;
  const c = useText(commonText);
  const [devices, setDevices] = useState<KioskDevice[]>([]);
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdDevice, setCreatedDevice] = useState<{ id: number; name: string; rawKey: string } | null>(
    null,
  );

  const slug = getTenantSlugFromPath();
  const kioskUrl = getPublicSiteKioskUrl(slug);

  const loadDevices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await kioskDeviceApi.list();
      setDevices(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD KIOSK DEVICES ERROR:", err);
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const openCreateModal = () => {
    setName("");
    setCreatedDevice(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setName("");
    if (createdDevice) {
      setCreatedDevice(null);
      loadDevices();
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      useToastStore.getState().show(t.nameRequired, "error");
      return;
    }
    try {
      setCreating(true);
      const res = await kioskDeviceApi.create(name.trim());
      const data = (res.data as any)?.data;
      setCreatedDevice({ id: data.id, name: data.name, rawKey: data.rawKey });
      useToastStore.getState().show(t.created, "success");
    } catch (err: any) {
      const msg = err?.response?.data?.message || t.createFailed;
      useToastStore.getState().show(msg, "error");
    } finally {
      setCreating(false);
    }
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      useToastStore.getState().show(t.copied(label), "success");
    } catch {
      useToastStore.getState().show(t.copyFailed, "error");
    }
  };

  const handleToggleActive = async (device: KioskDevice) => {
    try {
      await kioskDeviceApi.setActive(device.id, !device.isActive);
      setDevices((prev) =>
        prev.map((d) => (d.id === device.id ? { ...d, isActive: !d.isActive } : d)),
      );
      useToastStore
        .getState()
        .show(device.isActive ? t.deactivated : t.activated, "success");
    } catch (err: any) {
      const msg = err?.response?.data?.message || t.updateFailed;
      useToastStore.getState().show(msg, "error");
    }
  };

  const handleDelete = (device: KioskDevice) => {
    useConfirmStore.getState().show({
      title: t.deleteTitle,
      message: t.deleteMessage(device.name),
      confirmText: t.deleteConfirm,
      danger: true,
      onConfirm: async () => {
        try {
          await kioskDeviceApi.remove(device.id);
          useToastStore.getState().show(getText(attendanceText).kiosk.deleted, "success");
          setDevices((prev) => prev.filter((d) => d.id !== device.id));
        } catch (err: any) {
          const msg = err?.response?.data?.message || getText(attendanceText).kiosk.deleteFailed;
          useToastStore.getState().show(msg, "error");
        }
      },
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <Button onClick={openCreateModal} className="gap-1.5">
            <Plus size={15} />
            {t.newDevice}
          </Button>
        }
      />

      <SectionCard title={t.allDevices}>
        {loading ? (
          <SkeletonList items={3} />
        ) : devices.length === 0 ? (
          <EmptyState
            title={t.emptyTitle}
            hint={t.emptyHint}
          />
        ) : (
          <div className="space-y-3">
            {devices.map((device) => (
              <div
                key={device.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 p-4 dark:border-slate-800"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-gray-900 dark:text-slate-100">{device.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        device.isActive
                          ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                          : "bg-gray-200 text-gray-600 dark:bg-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {device.isActive ? t.active : t.inactive}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                    {t.lastSeen(formatDateTime(device.lastSeenAt) || t.neverConnected)}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    {t.createdAt(formatDateTime(device.createdAt) ?? "")}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(device)}
                    className={`rounded-lg p-1.5 transition ${
                      device.isActive
                        ? "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                        : "text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"
                    }`}
                    title={device.isActive ? t.deactivate : t.activate}
                  >
                    <Power size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(device)}
                    className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                    title={t.delete}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <Modal
        open={modalOpen}
        title={createdDevice ? t.keyTitle : t.newTitle}
        onClose={closeModal}
      >
        {!createdDevice ? (
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
                {t.name}
              </label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.namePlaceholder}
                autoFocus
              />
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={closeModal}>
                {c.cancel}
              </Button>
              <Button type="button" disabled={creating} onClick={handleCreate}>
                {creating ? t.creating : t.create}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-red-600 dark:text-red-400">
              {t.keyWarning}
            </p>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
                {t.deviceKey}
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 select-all break-all rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                  {createdDevice.rawKey}
                </code>
                <button
                  type="button"
                  onClick={() => copyText(createdDevice.rawKey, t.deviceKey)}
                  className="flex h-9 shrink-0 items-center gap-1 rounded-lg border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  title={t.copy}
                >
                  <Copy size={13} />
                  {t.copy}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
                {t.kioskUrl}
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 select-all break-all rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                  {kioskUrl}
                </code>
                <button
                  type="button"
                  onClick={() => copyText(kioskUrl, "URL")}
                  className="flex h-9 shrink-0 items-center gap-1 rounded-lg border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  title={t.copy}
                >
                  <Copy size={13} />
                  {t.copy}
                </button>
              </div>
            </div>

            <div className="mt-2 flex justify-end">
              <Button type="button" onClick={closeModal}>
                {t.done}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
