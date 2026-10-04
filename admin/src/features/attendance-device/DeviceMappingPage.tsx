import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, CreditCard, IdCard, Link2, RefreshCw, Search, X } from "lucide-react";
import { Link } from "react-router-dom";

import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import Input from "@madrasha/shared-ui/src/components/ui/Input";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import EmptyState from "@madrasha/shared-ui/src/components/ui/EmptyState";
import ErrorState from "@madrasha/shared-ui/src/components/ui/ErrorState";
import { SkeletonList } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import SectionCard from "../../components/settings/SectionCard";
import { attendanceDeviceApi, getApiErrorMessage } from "../../services/attendanceDeviceApi";

import { selectClass } from "./components";
import { useClassOptions, useTick } from "./hooks";
import type { StudentMapping, UnmappedDeviceUser } from "./types";
import { formatDateTime, relativeTime, toBnNumber } from "./utils";
import { commonText, getText, localizeDigits, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { attendanceDeviceText } from "./attendanceDevice.text";

const PAGE_SIZE = 20;

const useDebounced = <T,>(value: T, ms = 400) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
};

const mappedValue = (m: StudentMapping) =>
  m.device_user_id == null ? "" : String(m.device_user_id);

export default function DeviceMappingPage() {
  const t = useText(attendanceDeviceText).mapping;
  const lang = useLang();
  const classes = useClassOptions();
  const [assigning, setAssigning] = useState(false);
  const now = useTick(30_000);

  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput.trim());
  const [classId, setClassId] = useState("");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<StudentMapping[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [rowError, setRowError] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  const [unmapped, setUnmapped] = useState<UnmappedDeviceUser[]>([]);
  const [unmappedLoading, setUnmappedLoading] = useState(true);
  const [unmappedError, setUnmappedError] = useState(false);
  const [assignUser, setAssignUser] = useState<UnmappedDeviceUser | null>(null);

  const reqId = useRef(0);

  const loadStudents = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const res = await attendanceDeviceApi.listMappings(
        { search: search || undefined, class_id: classId || undefined, page, limit: PAGE_SIZE },
        { silent: true },
      );
      if (id !== reqId.current) return;
      setItems(res.items);
      setTotal(res.total);
      setLoadError(false);
      setDrafts({});
      setRowError({});
    } catch {
      if (id === reqId.current) setLoadError(true);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [search, classId, page]);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  const loadUnmapped = useCallback(async () => {
    setUnmappedLoading(true);
    try {
      setUnmapped(await attendanceDeviceApi.listUnmappedUsers({ silent: true }));
      setUnmappedError(false);
    } catch {
      setUnmappedError(true);
    } finally {
      setUnmappedLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUnmapped();
  }, [loadUnmapped]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /* ---------- inline edit ---------- */

  const setDraft = (studentId: number, value: string) => {
    setDrafts((p) => ({ ...p, [studentId]: value }));
    setRowError((p) => {
      if (!p[studentId]) return p;
      const n = { ...p };
      delete n[studentId];
      return n;
    });
  };

  const save = async (row: StudentMapping) => {
    const value = (drafts[row.student_id] ?? mappedValue(row)).trim();
    if (!value) {
      setRowError((p) => ({ ...p, [row.student_id]: t.userIdRequired }));
      return;
    }
    if (!/^\d+$/.test(value)) {
      setRowError((p) => ({ ...p, [row.student_id]: t.digitsOnly }));
      return;
    }
    setSavingId(row.student_id);
    try {
      await attendanceDeviceApi.setMapping(row.student_id, value);
      setItems((prev) =>
        prev.map((m) => (m.student_id === row.student_id ? { ...m, device_user_id: value } : m)),
      );
      setDrafts((p) => {
        const n = { ...p };
        delete n[row.student_id];
        return n;
      });
      useToastStore.getState().show(t.saved(row.name_bn), "success");
      void loadUnmapped();
    } catch (err) {
      setRowError((p) => ({
        ...p,
        [row.student_id]: getApiErrorMessage(err, t.saveFailed),
      }));
    } finally {
      setSavingId(null);
    }
  };

  const clear = async (row: StudentMapping) => {
    // Nothing saved yet - just discard the typed draft.
    if (row.device_user_id == null) {
      setDraft(row.student_id, "");
      return;
    }
    setSavingId(row.student_id);
    try {
      await attendanceDeviceApi.clearMapping(row.student_id);
      setItems((prev) =>
        prev.map((m) => (m.student_id === row.student_id ? { ...m, device_user_id: null } : m)),
      );
      setDrafts((p) => {
        const n = { ...p };
        delete n[row.student_id];
        return n;
      });
      useToastStore.getState().show(t.cleared(row.name_bn), "success");
      void loadUnmapped();
    } catch (err) {
      setRowError((p) => ({
        ...p,
        [row.student_id]: getApiErrorMessage(err, t.clearFailed),
      }));
    } finally {
      setSavingId(null);
    }
  };

  /* ---------- auto PINs ---------- */

  const autoAssign = () => {
    const tx = getText(attendanceDeviceText).mapping;
    const scope = (classId && classes.find((c) => String(c.id) === classId)?.name) || tx.allStudentsScope;
    useConfirmStore.getState().show({
      title: tx.autoAssignTitle,
      message: tx.autoAssignMessage(scope),
      confirmText: tx.autoAssignConfirm,
      onConfirm: async () => {
        setAssigning(true);
        try {
          const res = await attendanceDeviceApi.assignPins({
            attendee_type: "STUDENT",
            class_id: classId ? Number(classId) : undefined,
          });
          const created = Number(res?.created ?? 0);
          useToastStore
            .getState()
            .show(created > 0 ? tx.autoAssignDone(localizeDigits(created, lang)) : tx.autoAssignNone, "success");
          void loadStudents();
          void loadUnmapped();
        } catch {
          // interceptor toast
        } finally {
          setAssigning(false);
        }
      },
    });
  };

  /* ---------- render ---------- */

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <>
            <Link
              to="/attendance/device-cards"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <CreditCard size={15} />
              {t.cardsLink}
            </Link>
            <Button onClick={autoAssign} disabled={assigning} className="gap-1.5" title={t.autoAssignHint}>
              <IdCard size={15} className={assigning ? "animate-pulse" : ""} />
              {t.autoAssign}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <SectionCard title={t.studentList} badge={t.count(toBnNumber(total))}>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search
                size={15}
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <Input
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setPage(1);
                }}
                placeholder={t.searchPlaceholder}
                className="ps-9"
              />
            </div>
            <select
              className={`${selectClass} sm:w-52`}
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t.allClasses}</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {loading && items.length === 0 ? (
            <SkeletonList items={5} />
          ) : loadError ? (
            <ErrorState
              title={t.listLoadFailed}
              message={t.tryAgainDot}
              onRetry={loadStudents}
              retryText={t.retry}
            />
          ) : items.length === 0 ? (
            <EmptyState
              title={t.noStudents}
              hint={t.changeFilter}
            />
          ) : (
            <div className={loading ? "opacity-60 transition" : "transition"}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-start text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      <th className="py-2 pe-3 font-medium">{t.student}</th>
                      <th className="py-2 pe-3 font-medium">{t.class}</th>
                      <th className="py-2 pe-3 font-medium">{t.k40UserId}</th>
                      <th className="py-2 font-medium">{t.card}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => {
                      const value = drafts[row.student_id] ?? mappedValue(row);
                      const dirty = value.trim() !== mappedValue(row);
                      const busy = savingId === row.student_id;
                      const err = rowError[row.student_id];
                      return (
                        <tr
                          key={row.student_id}
                          className="border-b border-slate-100 align-top last:border-0 dark:border-slate-800"
                        >
                          <td className="py-2.5 pe-3">
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              {row.name_bn}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {t.idRoll(
                                String(row.student_id),
                                row.roll != null && row.roll !== "" ? String(row.roll) : null,
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 pe-3 text-slate-700 dark:text-slate-300">
                            {row.class_name || "—"}
                          </td>
                          <td className="py-2.5 pe-3">
                            <div className="flex items-center gap-1.5">
                              <Input
                                value={value}
                                onChange={(e) =>
                                  setDraft(row.student_id, e.target.value.replace(/\s/g, ""))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && dirty && !busy) void save(row);
                                }}
                                inputMode="numeric"
                                placeholder={t.userIdPlaceholder}
                                invalid={!!err}
                                disabled={busy}
                                className="!w-28 !py-1.5"
                              />
                              <button
                                type="button"
                                title={t.save}
                                disabled={!dirty || busy}
                                onClick={() => save(row)}
                                className="rounded-lg bg-indigo-600 p-2 text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                type="button"
                                title={t.clearMapping}
                                disabled={busy || (row.device_user_id == null && !dirty)}
                                onClick={() => clear(row)}
                                className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:bg-rose-950/30"
                              >
                                <X size={14} />
                              </button>
                            </div>
                            {err && (
                              <p className="mt-1 max-w-xs text-xs text-red-600 dark:text-red-400">
                                {err}
                              </p>
                            )}
                          </td>
                          <td className="py-2.5 font-mono text-xs text-slate-600 dark:text-slate-300">
                            {row.card_number ? localizeDigits(row.card_number, lang) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>
                  {t.page(toBnNumber(page), toBnNumber(pageCount))}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    className="gap-1 px-3 py-1.5 text-xs"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={14} className="rtl:rotate-180" />
                    {t.prev}
                  </Button>
                  <Button
                    variant="secondary"
                    className="gap-1 px-3 py-1.5 text-xs"
                    disabled={page >= pageCount || loading}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {t.next}
                    <ChevronRight size={14} className="rtl:rotate-180" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title={t.unmappedTitle}
          hint={t.unmappedHint}
          actions={
            <button
              type="button"
              title={t.refresh}
              onClick={loadUnmapped}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <RefreshCw size={14} className={unmappedLoading ? "animate-spin" : ""} />
            </button>
          }
        >
          {unmappedLoading && unmapped.length === 0 ? (
            <SkeletonList items={3} />
          ) : unmappedError ? (
            <p className="text-sm text-rose-600 dark:text-rose-400">{t.unmappedLoadFailed}</p>
          ) : unmapped.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t.allMapped}
            </p>
          ) : (
            <ul className="space-y-2">
              {unmapped.map((u) => (
                <li
                  key={String(u.device_user_id)}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 p-3 dark:border-slate-800"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {t.userId(String(u.device_user_id))}
                    </div>
                    <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {u.device_name || t.unknownDevice} · {t.punches(toBnNumber(u.punch_count))}
                    </div>
                    <div
                      className="text-[11px] text-slate-400"
                      title={formatDateTime(u.last_punch_at)}
                    >
                      {t.lastPunch(relativeTime(u.last_punch_at, now, "—"))}
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    className="shrink-0 gap-1 px-2.5 py-1.5 text-xs"
                    onClick={() => setAssignUser(u)}
                  >
                    <Link2 size={13} />
                    {t.link}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <AssignModal
        user={assignUser}
        onClose={() => setAssignUser(null)}
        onAssigned={() => {
          setAssignUser(null);
          void loadUnmapped();
          void loadStudents();
        }}
      />
    </div>
  );
}

/* ---------------- assign an unmapped device user to a student ---------------- */

function AssignModal({
  user,
  onClose,
  onAssigned,
}: {
  user: UnmappedDeviceUser | null;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const t = useText(attendanceDeviceText).mapping;
  const c = useText(commonText);
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query.trim(), 350);
  const [results, setResults] = useState<StudentMapping[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<StudentMapping | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      setQuery("");
      setResults([]);
      setSelected(null);
      setError("");
    }
  }, [user]);

  useEffect(() => {
    if (!user || debounced.length < 1) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    attendanceDeviceApi
      .listMappings({ search: debounced, page: 1, limit: 8 }, { silent: true })
      .then((res) => {
        if (!cancelled) setResults(res.items);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, user]);

  const assign = async () => {
    if (!user || !selected) return;
    setSaving(true);
    setError("");
    try {
      await attendanceDeviceApi.setMapping(selected.student_id, String(user.device_user_id));
      useToastStore
        .getState()
        .show(t.assigned(String(user.device_user_id), selected.name_bn), "success");
      onAssigned();
    } catch (err) {
      setError(getApiErrorMessage(err, t.assignFailed));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!user}
      title={t.assignTitle(String(user?.device_user_id ?? ""))}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
              setError("");
            }}
            placeholder={t.assignSearch}
            className="ps-9"
            autoFocus
          />
        </div>

        <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-800">
          {searching ? (
            <p className="p-3 text-sm text-slate-500">{t.searching}</p>
          ) : results.length === 0 ? (
            <p className="p-3 text-sm text-slate-500 dark:text-slate-400">
              {debounced ? t.noStudents : t.typeToSearch}
            </p>
          ) : (
            results.map((s) => {
              const active = selected?.student_id === s.student_id;
              const taken = s.device_user_id != null;
              return (
                <button
                  key={s.student_id}
                  type="button"
                  onClick={() => {
                    setSelected(s);
                    setError("");
                  }}
                  className={`flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-start text-sm last:border-0 dark:border-slate-800 ${
                    active
                      ? "bg-indigo-50 dark:bg-indigo-950/40"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-900 dark:text-slate-100">
                      {s.name_bn}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {s.class_name || "—"}
                      {s.roll != null && s.roll !== "" && t.roll(String(s.roll))}
                    </span>
                  </span>
                  {taken && (
                    <span className="shrink-0 text-[11px] text-amber-600 dark:text-amber-400">
                      {t.alreadyUser(String(s.device_user_id))}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {selected?.device_user_id != null && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {t.willReplace(String(selected.device_user_id))}
          </p>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {c.cancel}
          </Button>
          <Button type="button" disabled={!selected || saving} onClick={assign}>
            {saving ? t.linking : t.link}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
