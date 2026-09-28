import { useCallback, useEffect, useState } from "react";
import api from "../../services/api";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { SkeletonTable } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { commonText, formatDate as formatLangDate, localizeDigits, useLang, useText, type Lang } from "@madrasha/shared-ui/src/i18n";
import { trashText } from "./trash.text";

type TrashText = typeof trashText.bn;

type TabKey = "students" | "teachers" | "exams" | "divisions" | "classes" | "books" | "results";

interface TrashStudentRow {
  id: number | string;
  name_bn?: string | null;
  roll?: number | string | null;
  registration_no?: number | string | null;
  current_class?: string | null;
  deleted_at?: string | null;
  days_remaining: number;
}

interface TrashTeacherRow {
  id: number | string;
  name_bn?: string | null;
  registration_no?: number | string | null;
  phone?: string | null;
  academic_division_name?: string | null;
  deleted_at?: string | null;
  days_remaining: number;
}

interface TrashExamRow {
  id: number | string;
  name?: string | null;
  year?: string | null;
  deleted_at?: string | null;
  days_remaining: number;
}

interface TrashDivisionRow {
  id: number | string;
  name_bn?: string | null;
  name?: string | null;
  deleted_at?: string | null;
  days_remaining: number;
}

interface TrashClassRow {
  id: number | string;
  class_name_bn?: string | null;
  class_name?: string | null;
  division_name_bn?: string | null;
  deleted_at?: string | null;
  days_remaining: number;
}

interface TrashBookRow {
  id: number | string;
  book_name_bn?: string | null;
  book_name?: string | null;
  deleted_at?: string | null;
  days_remaining: number;
}

interface TrashResultRow {
  id: number | string;
  exam_name?: string | null;
  exam_year?: string | null;
  class_name_bn?: string | null;
  class_name?: string | null;
  status?: string | null;
  deleted_at?: string | null;
  days_remaining: number;
}

type TrashRow =
  | TrashStudentRow
  | TrashTeacherRow
  | TrashExamRow
  | TrashDivisionRow
  | TrashClassRow
  | TrashBookRow
  | TrashResultRow;

const TABS: TabKey[] = ["students", "teachers", "exams", "divisions", "classes", "books", "results"];

// Different tabs key their display name under different fields (results
// don't have a single "name" at all — they're identified by exam + class).
const getRowName = (tab: TabKey, row: TrashRow): string => {
  switch (tab) {
    case "exams":
      return (row as TrashExamRow).name || "";
    case "divisions":
      return (row as TrashDivisionRow).name_bn || "";
    case "classes":
      return (row as TrashClassRow).class_name_bn || "";
    case "books":
      return (row as TrashBookRow).book_name_bn || "";
    case "results": {
      const r = row as TrashResultRow;
      return [r.exam_name, r.class_name_bn].filter(Boolean).join(" - ");
    }
    default:
      return (row as TrashStudentRow | TrashTeacherRow).name_bn || "";
  }
};

const extractArray = (res: any): any[] => {
  const data = res?.data?.data ?? res?.data ?? [];
  return Array.isArray(data) ? data : [];
};

const formatDate = (value: string | null | undefined, lang: Lang) => {
  if (!value) return "-";
  return formatLangDate(value, lang, { day: "numeric", month: "long", year: "numeric" }) || "-";
};

const daysBadge = (days: number, t: TrashText, lang: Lang) => {
  const label = days <= 0 ? t.deletesToday : t.daysLeft(localizeDigits(days, lang));
  const classes =
    days <= 1
      ? "bg-red-100 text-red-700 border-red-300"
      : days <= 3
        ? "bg-amber-100 text-amber-700 border-amber-300"
        : "bg-gray-100 text-gray-600 border-gray-300";
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${classes}`}>
      ⏳ {label}
    </span>
  );
};

export default function TrashPage() {
  const t = useText(trashText);
  const c = useText(commonText);
  const lang = useLang();
  const n = (value: number) => localizeDigits(value, lang);
  const [activeTab, setActiveTab] = useState<TabKey>("students");
  const [rowsByTab, setRowsByTab] = useState<Record<TabKey, TrashRow[]>>({
    students: [],
    teachers: [],
    exams: [],
    divisions: [],
    classes: [],
    books: [],
    results: [],
  });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectedByTab, setSelectedByTab] = useState<Record<TabKey, Set<string | number>>>({
    students: new Set(),
    teachers: new Set(),
    exams: new Set(),
    divisions: new Set(),
    classes: new Set(),
    books: new Set(),
    results: new Set(),
  });

  // Load all three tabs up front (not just the active one) so the tab
  // counts are visible immediately instead of only appearing once a tab
  // has actually been clicked into.
  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [students, teachers, exams, divisions, classes, books, results] = await Promise.all([
        api.get("/trash/students"),
        api.get("/trash/teachers"),
        api.get("/trash/exams"),
        api.get("/trash/divisions"),
        api.get("/trash/classes"),
        api.get("/trash/books"),
        api.get("/trash/results"),
      ]);
      setRowsByTab({
        students: extractArray(students),
        teachers: extractArray(teachers),
        exams: extractArray(exams),
        divisions: extractArray(divisions),
        classes: extractArray(classes),
        books: extractArray(books),
        results: extractArray(results),
      });
    } catch (err) {
      logger.error("LOAD TRASH ERROR:", err);
      useToastStore.getState().show(t.loadFailed, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const removeRows = (tab: TabKey, ids: (string | number)[]) => {
    const idSet = new Set(ids);
    setRowsByTab((prev) => ({
      ...prev,
      [tab]: prev[tab].filter((row) => !idSet.has(row.id)),
    }));
    setSelectedByTab((prev) => {
      const next = new Set(prev[tab]);
      ids.forEach((id) => next.delete(id));
      return { ...prev, [tab]: next };
    });
  };

  const removeRow = (tab: TabKey, id: string | number) => removeRows(tab, [id]);

  const toggleSelect = (tab: TabKey, id: string | number) => {
    setSelectedByTab((prev) => {
      const next = new Set(prev[tab]);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, [tab]: next };
    });
  };

  const toggleSelectAll = (tab: TabKey, ids: (string | number)[]) => {
    setSelectedByTab((prev) => {
      const current = prev[tab];
      const allSelected = ids.length > 0 && ids.every((id) => current.has(id));
      return { ...prev, [tab]: allSelected ? new Set() : new Set(ids) };
    });
  };

  const handleRestore = (tab: TabKey, row: TrashRow) => {
    const name = getRowName(tab, row);
    useConfirmStore.getState().show({
      title: t.restoreTitle,
      message: t.restoreMessage(name || ""),
      confirmText: t.restore,
      onConfirm: async () => {
        try {
          setBusyId(row.id);
          await api.post(`/trash/${tab}/${row.id}/restore`);
          useToastStore.getState().show(t.restored, "success");
          removeRow(tab, row.id);
        } catch (err: any) {
          useToastStore
            .getState()
            .show(err?.response?.data?.message || t.restoreFailed, "error");
        } finally {
          setBusyId(null);
        }
      },
    });
  };

  const handlePermanentDelete = (tab: TabKey, row: TrashRow) => {
    const name = getRowName(tab, row);
    useConfirmStore.getState().show({
      title: t.deleteTitle,
      message: t.deleteMessage(name || ""),
      confirmText: t.deleteForever,
      danger: true,
      onConfirm: async () => {
        try {
          setBusyId(row.id);
          await api.delete(`/trash/${tab}/${row.id}`);
          useToastStore.getState().show(t.deletedForever, "success");
          removeRow(tab, row.id);
        } catch (err: any) {
          useToastStore
            .getState()
            .show(err?.response?.data?.message || t.deleteFailed, "error");
        } finally {
          setBusyId(null);
        }
      },
    });
  };

  const handleBulkRestore = (tab: TabKey, targetRows: TrashRow[]) => {
    if (targetRows.length === 0) return;
    useConfirmStore.getState().show({
      title: t.restoreTitle,
      message: t.bulkRestoreMessage(n(targetRows.length)),
      confirmText: t.restore,
      onConfirm: async () => {
        setBulkBusy(true);
        try {
          const results = await Promise.allSettled(
            targetRows.map((row) => api.post(`/trash/${tab}/${row.id}/restore`)),
          );
          const succeededIds = targetRows
            .filter((_, i) => results[i].status === "fulfilled")
            .map((row) => row.id);
          const failedCount = results.length - succeededIds.length;
          if (succeededIds.length > 0) removeRows(tab, succeededIds);
          if (failedCount === 0) {
            useToastStore.getState().show(t.restored, "success");
          } else if (succeededIds.length === 0) {
            useToastStore.getState().show(t.restoreFailed, "error");
          } else {
            useToastStore
              .getState()
              .show(
                t.bulkRestorePartial(n(succeededIds.length), n(failedCount)),
                "error",
              );
          }
        } finally {
          setBulkBusy(false);
        }
      },
    });
  };

  const handleBulkDelete = (tab: TabKey, targetRows: TrashRow[]) => {
    if (targetRows.length === 0) return;
    useConfirmStore.getState().show({
      title: t.deleteTitle,
      message: t.bulkDeleteMessage(n(targetRows.length)),
      confirmText: t.deleteForever,
      danger: true,
      onConfirm: async () => {
        setBulkBusy(true);
        try {
          const results = await Promise.allSettled(
            targetRows.map((row) => api.delete(`/trash/${tab}/${row.id}`)),
          );
          const succeededIds = targetRows
            .filter((_, i) => results[i].status === "fulfilled")
            .map((row) => row.id);
          const failedCount = results.length - succeededIds.length;
          if (succeededIds.length > 0) removeRows(tab, succeededIds);
          if (failedCount === 0) {
            useToastStore.getState().show(t.deletedForever, "success");
          } else if (succeededIds.length === 0) {
            useToastStore.getState().show(t.deleteFailed, "error");
          } else {
            useToastStore
              .getState()
              .show(
                t.bulkDeletePartial(n(succeededIds.length), n(failedCount)),
                "error",
              );
          }
        } finally {
          setBulkBusy(false);
        }
      },
    });
  };

  const rows = rowsByTab[activeTab];
  const selected = selectedByTab[activeTab];
  const selectedRows = rows.filter((row) => selected.has(row.id));
  const allVisibleSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));

  return (
    <div className="min-h-screen bg-gray-50 p-3 dark:bg-slate-950 sm:p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 sm:text-2xl">🗑️ {t.title}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            {t.subtitle}
          </p>
        </div>

        <div className="mb-4 flex gap-2 border-b border-gray-200 dark:border-slate-800">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                activeTab === tab
                  ? "border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {t.tabs[tab]}
              <span
                className={`ms-1.5 rounded-full px-1.5 py-0.5 text-[11px] ${
                  rowsByTab[tab].length > 0
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                    : "bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {n(rowsByTab[tab].length)}
              </span>
            </button>
          ))}
        </div>

        {selected.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-900 dark:bg-blue-950/30">
            <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
              {t.selectedCount(n(selected.size))}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => handleBulkRestore(activeTab, selectedRows)}
                className="h-8 rounded-md bg-green-600 px-3 text-xs font-medium text-white transition hover:bg-green-700 disabled:opacity-60"
              >
                {t.restoreSelected}
              </button>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => handleBulkDelete(activeTab, selectedRows)}
                className="h-8 rounded-md bg-red-600 px-3 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {t.deleteSelected}
              </button>
            </div>
          </div>
        )}

        <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
          {loading ? (
            <SkeletonTable rows={5} columns={4} />
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500 dark:text-slate-400">{t.empty}</div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="flex flex-col gap-3 sm:hidden">
                {rows.map((row) => (
                  <div key={row.id} className="rounded-lg border border-gray-200 p-3 shadow-sm dark:border-slate-700">
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selected.has(row.id)}
                          onChange={() => toggleSelect(activeTab, row.id)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <span className="font-semibold text-gray-800 dark:text-slate-100">{getRowName(activeTab, row)}</span>
                      </label>
                      {daysBadge(row.days_remaining, t, lang)}
                    </div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                      {activeTab === "students" && (
                        <>
                          {t.roll}: {(row as TrashStudentRow).roll ?? t.none} | {t.class}:{" "}
                          {(row as TrashStudentRow).current_class || t.none}
                        </>
                      )}
                      {activeTab === "teachers" && (
                        <>
                          {t.regNo}: {(row as TrashTeacherRow).registration_no ?? t.none} | {t.phone}:{" "}
                          {(row as TrashTeacherRow).phone || t.none}
                        </>
                      )}
                      {activeTab === "exams" && <>{t.year}: {(row as TrashExamRow).year || t.none}</>}
                      {activeTab === "classes" && (
                        <>{t.division}: {(row as TrashClassRow).division_name_bn || t.none}</>
                      )}
                      {activeTab === "results" && (
                        <>
                          {t.year}: {(row as TrashResultRow).exam_year || t.none} | {t.state}:{" "}
                          {(row as TrashResultRow).status || t.none}
                        </>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-gray-400 dark:text-slate-500">
                      {t.deletedAt}: {formatDate(row.deleted_at, lang)}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        disabled={busyId === row.id || bulkBusy}
                        onClick={() => handleRestore(activeTab, row)}
                        className="h-9 flex-1 rounded-md bg-green-600 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-60"
                      >
                        {t.restore}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === row.id || bulkBusy}
                        onClick={() => handlePermanentDelete(activeTab, row)}
                        className="h-9 flex-1 rounded-md bg-red-600 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
                      >
                        {t.permanentDelete}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="min-w-full text-start text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs uppercase text-gray-500 dark:border-slate-800 dark:text-slate-400">
                      <th className="px-3 py-2 w-8">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={() => toggleSelectAll(activeTab, rows.map((row) => row.id))}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </th>
                      <th className="px-3 py-2">{c.name}</th>
                      {activeTab === "students" && (
                        <>
                          <th className="px-3 py-2">{t.roll}</th>
                          <th className="px-3 py-2">{t.class}</th>
                        </>
                      )}
                      {activeTab === "teachers" && (
                        <>
                          <th className="px-3 py-2">{t.regNo}</th>
                          <th className="px-3 py-2">{t.phone}</th>
                        </>
                      )}
                      {activeTab === "exams" && <th className="px-3 py-2">{t.year}</th>}
                      {activeTab === "classes" && <th className="px-3 py-2">{t.division}</th>}
                      {activeTab === "results" && (
                        <>
                          <th className="px-3 py-2">{t.year}</th>
                          <th className="px-3 py-2">{t.state}</th>
                        </>
                      )}
                      <th className="px-3 py-2">{t.deletedAt}</th>
                      <th className="px-3 py-2">{t.validity}</th>
                      <th className="px-3 py-2 text-end">{c.actions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-b border-gray-100 dark:border-slate-800">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selected.has(row.id)}
                            onChange={() => toggleSelect(activeTab, row.id)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-800 dark:text-slate-100">
                          {getRowName(activeTab, row)}
                        </td>
                        {activeTab === "students" && (
                          <>
                            <td className="px-3 py-2">{(row as TrashStudentRow).roll ?? t.none}</td>
                            <td className="px-3 py-2">
                              {(row as TrashStudentRow).current_class || t.none}
                            </td>
                          </>
                        )}
                        {activeTab === "teachers" && (
                          <>
                            <td className="px-3 py-2">
                              {(row as TrashTeacherRow).registration_no ?? t.none}
                            </td>
                            <td className="px-3 py-2">{(row as TrashTeacherRow).phone || t.none}</td>
                          </>
                        )}
                        {activeTab === "exams" && (
                          <td className="px-3 py-2">{(row as TrashExamRow).year || t.none}</td>
                        )}
                        {activeTab === "classes" && (
                          <td className="px-3 py-2">{(row as TrashClassRow).division_name_bn || t.none}</td>
                        )}
                        {activeTab === "results" && (
                          <>
                            <td className="px-3 py-2">{(row as TrashResultRow).exam_year || t.none}</td>
                            <td className="px-3 py-2">{(row as TrashResultRow).status || t.none}</td>
                          </>
                        )}
                        <td className="px-3 py-2 text-gray-500 dark:text-slate-400">{formatDate(row.deleted_at, lang)}</td>
                        <td className="px-3 py-2">{daysBadge(row.days_remaining, t, lang)}</td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              disabled={busyId === row.id || bulkBusy}
                              onClick={() => handleRestore(activeTab, row)}
                              className="h-8 rounded-md bg-green-600 px-3 text-xs font-medium text-white transition hover:bg-green-700 disabled:opacity-60"
                            >
                              {t.restore}
                            </button>
                            <button
                              type="button"
                              disabled={busyId === row.id || bulkBusy}
                              onClick={() => handlePermanentDelete(activeTab, row)}
                              className="h-8 rounded-md bg-red-600 px-3 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
                            >
                              {t.permanentDelete}
                            </button>
                          </div>
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
    </div>
  );
}
