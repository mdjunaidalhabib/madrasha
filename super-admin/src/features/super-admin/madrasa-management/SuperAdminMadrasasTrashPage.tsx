import { useEffect, useState } from "react";
import adminApi from "../../../services/adminApi";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import DeleteConfirmModal from "../../../components/super-admin/DeleteConfirmModal";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { SkeletonTable } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { commonText, formatDateTime, formatNumber, getLang, getText, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { madrasasText } from "./madrasas.text";

type DeleteStats = { students: number; users: number; accounts: number };

type PendingDelete = {
  ids: number[];
  stats: DeleteStats;
};

const EMPTY_STATS: DeleteStats = { students: 0, users: 0, accounts: 0 };

export default function SuperAdminMadrasasTrashPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const selectionMode = selectedIds.size > 0;
  const allSelected = items.length > 0 && items.every((m) => selectedIds.has(m.id));

  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const toast = useToastStore();
  const t = useText(madrasasText);
  const c = useText(commonText);
  const lang = useLang();
  const n = (v: number) => formatNumber(v, lang);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await adminApi.get("/super/madrasas/trash");

      const rows = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);

      setItems(rows);
      setSelectedIds(new Set());
    } finally {
      setLoading(false);
    }
  };

  const toggleOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) => {
      const isAllSelected = items.length > 0 && items.every((m) => prev.has(m.id));
      return isAllSelected ? new Set() : new Set(items.map((m) => m.id));
    });
  };

  const restore = async (id: number) => {
    setBusyId(id);
    try {
      const res = await adminApi.post(`/super/madrasas/${id}/restore`);
      toast.push("success", res.data?.message || getText(madrasasText).restored);
      await load();
    } catch (err: any) {
      toast.push("error", err?.response?.data?.message || getText(madrasasText).restoreFailed);
    } finally {
      setBusyId(null);
    }
  };

  const fetchStats = async (id: number): Promise<DeleteStats> => {
    const res = await adminApi.get(`/super/madrasas/${id}/delete-stats`);
    return res.data;
  };

  // 🔥 Open delete modal for a single madrasa + fetch its stats
  const openDeleteModal = async (m: any) => {
    setStatsLoading(true);
    try {
      const stats = await fetchStats(m.id);
      setPendingDelete({ ids: [m.id], stats });
    } catch (err: any) {
      toast.push("error", err?.response?.data?.message || getText(madrasasText).statsFailed);
    } finally {
      setStatsLoading(false);
    }
  };

  // 🔥 Open delete modal for every selected madrasa, aggregating their stats
  const openBulkDeleteModal = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;

    setStatsLoading(true);
    try {
      const results = await Promise.all(ids.map(fetchStats));
      const stats = results.reduce<DeleteStats>(
        (acc, s) => ({
          students: acc.students + (s.students || 0),
          users: acc.users + (s.users || 0),
          accounts: acc.accounts + (s.accounts || 0),
        }),
        { ...EMPTY_STATS },
      );
      setPendingDelete({ ids, stats });
    } catch (err: any) {
      toast.push("error", err?.response?.data?.message || getText(madrasasText).statsFailed);
    } finally {
      setStatsLoading(false);
    }
  };

  const confirmPermanentDelete = async () => {
    if (!pendingDelete) return;

    const { ids } = pendingDelete;
    setBulkBusy(true);
    setProgress({ done: 0, total: ids.length });

    const failed: number[] = [];

    // Sequential on purpose — keeps the progress counter meaningful and
    // avoids hammering the server with a burst of cascade-delete transactions.
    for (const id of ids) {
      try {
        await adminApi.delete(`/super/madrasas/${id}/permanent`);
      } catch {
        failed.push(id);
      } finally {
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    }

    setBulkBusy(false);
    setPendingDelete(null);

    const tx = getText(madrasasText);
    const nn = (v: number) => formatNumber(v, getLang());
    if (failed.length === 0) {
      toast.push("success", ids.length > 1 ? tx.manyDeleted(nn(ids.length)) : tx.oneDeleted);
    } else if (failed.length < ids.length) {
      toast.push(
        "error",
        tx.partialDeleted(nn(ids.length - failed.length), nn(failed.length)),
      );
    } else {
      toast.push("error", tx.deleteFailed);
    }

    await load();
  };

  return (
    <div className="bg-white p-4 rounded shadow dark:bg-slate-900">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold dark:text-slate-100">{t.trashTitle}</h2>

        {selectionMode && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 dark:border-indigo-900 dark:bg-indigo-950/40">
            <span className="text-sm font-medium text-indigo-800 dark:text-indigo-300">
              {t.selected(n(selectedIds.size))}
            </span>
            <Button
              variant="secondary"
              onClick={() => setSelectedIds(new Set())}
              disabled={statsLoading || bulkBusy}
            >
              {c.clear}
            </Button>
            <Button variant="danger" onClick={openBulkDeleteModal} disabled={statsLoading || bulkBusy}>
              {statsLoading ? c.loading : t.permanentlyDeleteN(n(selectedIds.size))}
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <SkeletonTable rows={6} columns={5} />
      ) : !items.length ? (
        <p className="text-gray-500 dark:text-slate-400">{t.trashEmpty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr>
                <th className="w-10 p-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 dark:border-slate-600"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label={t.selectAll}
                  />
                </th>
                <th className="text-start p-2 dark:text-slate-200">{c.name}</th>
                <th className="text-start p-2 dark:text-slate-200">{t.slug}</th>
                <th className="text-start p-2 dark:text-slate-200">{t.deletedAt}</th>
                <th className="text-start p-2 dark:text-slate-200">{c.actions}</th>
              </tr>
            </thead>

            <tbody>
              {items.map((m) => {
                const locked = busyId === m.id || selectionMode;
                return (
                  <tr key={m.id} className="border-t dark:border-slate-800">
                    <td className="p-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 dark:border-slate-600"
                        checked={selectedIds.has(m.id)}
                        onChange={() => toggleOne(m.id)}
                        aria-label={t.selectRow(m.name)}
                      />
                    </td>
                    <td className="p-2 dark:text-slate-100">{m.name}</td>
                    <td className="p-2 dark:text-slate-300">{m.slug}</td>
                    <td className="p-2 text-gray-500 dark:text-slate-400">
                      {m.deleted_at ? formatDateTime(m.deleted_at, lang) : "-"}
                    </td>
                    <td className="p-2">
                      <div className="flex gap-2 flex-wrap">
                        <Button onClick={() => restore(m.id)} disabled={locked}>
                          {busyId === m.id ? "..." : t.restore}
                        </Button>

                        <Button variant="danger" onClick={() => openDeleteModal(m)} disabled={locked}>
                          {t.deletePermanently}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 🔥 Double Confirm Modal — single or bulk */}
      {pendingDelete && (
        <DeleteConfirmModal
          stats={pendingDelete.stats}
          count={pendingDelete.ids.length}
          busy={bulkBusy}
          busyLabel={
            pendingDelete.ids.length > 1 ? t.deletingProgress(n(progress.done), n(progress.total)) : t.deleting
          }
          onClose={() => {
            if (bulkBusy) return;
            setPendingDelete(null);
          }}
          onConfirm={confirmPermanentDelete}
        />
      )}
    </div>
  );
}
