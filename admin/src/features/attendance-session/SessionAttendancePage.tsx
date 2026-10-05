import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CalendarOff, Lock, Pencil, Plus, Trash2 } from "lucide-react";

import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import Badge from "@madrasha/shared-ui/src/components/ui/Badge";
import ErrorState from "@madrasha/shared-ui/src/components/ui/ErrorState";
import { SkeletonList, SkeletonTable } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { commonText, formatNumber, getText, localizeDigits, useLang, useText } from "@madrasha/shared-ui/src/i18n";

import { useAuthStore } from "../../store/authStore";
import { hasPermission } from "../../utils/permissions";
import {
  ATTENDANCE_STATUSES,
  apiErrorCode,
  loadAllClasses,
  localIso,
  monthStartIso,
  sessionApi,
  type AttendanceSession,
  type AttendanceStatus,
  type ClassOption,
  type SessionPayload,
  type SessionReport,
  type SessionSheet,
} from "../../services/attendanceV3Api";
import {
  EmptyRow,
  Field,
  RateBar,
  Tabs,
  cardClass,
  fieldClass,
  formatPercent,
  tdClass,
  thClass,
} from "../attendance-analytics/shared";
import { attendanceSessionText } from "./attendanceSession.text";

type TabKey = "mark" | "manage" | "report";

const toast = (msg: string, type: "success" | "error" | "info" = "info") => useToastStore.getState().show(msg, type);

const STATUS_STYLE: Record<AttendanceStatus, { on: string; off: string }> = {
  PRESENT: {
    on: "bg-emerald-600 text-white ring-emerald-600",
    off: "text-emerald-700 ring-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:ring-emerald-900 dark:hover:bg-emerald-950/40",
  },
  LATE: {
    on: "bg-amber-500 text-white ring-amber-500",
    off: "text-amber-700 ring-amber-200 hover:bg-amber-50 dark:text-amber-400 dark:ring-amber-900 dark:hover:bg-amber-950/40",
  },
  ABSENT: {
    on: "bg-rose-600 text-white ring-rose-600",
    off: "text-rose-700 ring-rose-200 hover:bg-rose-50 dark:text-rose-400 dark:ring-rose-900 dark:hover:bg-rose-950/40",
  },
  LEAVE: {
    on: "bg-blue-600 text-white ring-blue-600",
    off: "text-blue-700 ring-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:ring-blue-900 dark:hover:bg-blue-950/40",
  },
};

const sortSessions = (list: AttendanceSession[]) =>
  list.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id);

const timeRange = (s: AttendanceSession) =>
  s.start_time || s.end_time ? `${(s.start_time ?? "").slice(0, 5)}${s.end_time ? ` - ${s.end_time.slice(0, 5)}` : ""}` : "";

export default function SessionAttendancePage() {
  const t = useText(attendanceSessionText);
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const canManageSessions = hasPermission(user, permissions, "attendance.session");
  const canMark = hasPermission(user, permissions, "attendance.mark");

  const [tab, setTab] = useState<TabKey>("mark");
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [classes, setClasses] = useState<ClassOption[]>([]);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      setSessions(sortSessions(await sessionApi.list(true, { silent: true })));
    } catch {
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
    loadAllClasses()
      .then(setClasses)
      .catch(() => setClasses([]));
  }, [loadSessions]);

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "mark", label: t.tabs.mark },
    ...(canManageSessions ? [{ key: "manage" as const, label: t.tabs.manage }] : []),
    { key: "report", label: t.tabs.report },
  ];

  return (
    <div className="mx-auto max-w-6xl p-3 sm:p-4 md:p-6">
      <PageHeader title={t.title} subtitle={t.subtitle} />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === "mark" && (
        <MarkTab
          sessions={sessions.filter((s) => s.is_active)}
          sessionsLoading={sessionsLoading}
          classes={classes}
          canMark={canMark}
          onGoManage={canManageSessions ? () => setTab("manage") : undefined}
        />
      )}
      {tab === "manage" && canManageSessions && (
        <ManageTab sessions={sessions} loading={sessionsLoading} reload={loadSessions} />
      )}
      {tab === "report" && <ReportTab sessions={sessions} classes={classes} />}
    </div>
  );
}

/* ================================================================= mark */

function MarkTab({
  sessions,
  sessionsLoading,
  classes,
  canMark,
  onGoManage,
}: {
  sessions: AttendanceSession[];
  sessionsLoading: boolean;
  classes: ClassOption[];
  canMark: boolean;
  onGoManage?: () => void;
}) {
  const t = useText(attendanceSessionText);
  const lang = useLang();
  const n = (v: number) => formatNumber(v, lang);
  const today = localIso();

  const [sessionId, setSessionId] = useState("");
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(today);

  const [sheet, setSheet] = useState<SessionSheet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [statusBy, setStatusBy] = useState<Record<number, AttendanceStatus | null>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Pre-select the first session once the list is in.
  useEffect(() => {
    if (!sessionId && sessions.length > 0) setSessionId(String(sessions[0].id));
  }, [sessions, sessionId]);

  const loadSheet = useCallback(async () => {
    if (!sessionId || !classId || !date) {
      setSheet(null);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const data = await sessionApi.sheet({ session_id: Number(sessionId), class_id: Number(classId), date });
      setSheet(data);
      const next: Record<number, AttendanceStatus | null> = {};
      for (const s of data.students) next[s.student_id] = s.status ?? null;
      setStatusBy(next);
      setDirty(false);
    } catch {
      setSheet(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [sessionId, classId, date]);

  useEffect(() => {
    loadSheet();
  }, [loadSheet]);

  const students = useMemo(
    () =>
      (sheet?.students ?? [])
        .slice()
        .sort((a, b) => Number(a.roll ?? 1e9) - Number(b.roll ?? 1e9) || a.name.localeCompare(b.name)),
    [sheet],
  );

  const offDay = sheet?.off_day
    ? typeof sheet.off_day === "object"
      ? sheet.off_day.title || t.offDay
      : t.offDay
    : null;
  const readOnly = !canMark || !sheet?.editable || !!offDay;

  const counts = useMemo(() => {
    const c: Record<AttendanceStatus, number> = { PRESENT: 0, LATE: 0, ABSENT: 0, LEAVE: 0 };
    let marked = 0;
    for (const s of students) {
      const st = statusBy[s.student_id];
      if (st) {
        c[st] += 1;
        marked += 1;
      }
    }
    return { ...c, marked, unmarked: students.length - marked };
  }, [students, statusBy]);

  const setStatus = (id: number, st: AttendanceStatus) => {
    if (readOnly) return;
    setStatusBy((prev) => ({ ...prev, [id]: prev[id] === st ? null : st }));
    setDirty(true);
  };

  const markAll = (st: AttendanceStatus | null) => {
    if (readOnly) return;
    const next: Record<number, AttendanceStatus | null> = {};
    for (const s of students) next[s.student_id] = st;
    setStatusBy(next);
    setDirty(true);
  };

  const save = async () => {
    const entries = students
      .filter((s) => statusBy[s.student_id])
      .map((s) => ({ student_id: s.student_id, status: statusBy[s.student_id] as AttendanceStatus }));
    if (entries.length === 0) return toast(getText(attendanceSessionText).nothingToSave, "error");
    setSaving(true);
    try {
      const res = await sessionApi.mark({ session_id: Number(sessionId), date, class_id: Number(classId), entries });
      const tx = getText(attendanceSessionText);
      toast(tx.saved, "success");
      if (res.skipped.length > 0) {
        const names = students
          .filter((s) => res.skipped.includes(s.student_id))
          .map((s) => s.name)
          .slice(0, 5)
          .join(", ");
        toast(`${tx.skippedSome(formatNumber(res.skipped.length, lang))}${names ? `: ${names}` : ""}`, "info");
      }
      setDirty(false);
    } catch {
      // interceptor shows the server message
    } finally {
      setSaving(false);
    }
  };

  if (!sessionsLoading && sessions.length === 0) {
    return (
      <div className={`${cardClass} text-center`}>
        <EmptyRow text={t.noSessions} />
        {onGoManage && (
          <Button onClick={onGoManage} className="mb-4">
            <Plus size={16} className="me-1" />
            {t.manage.add}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`${cardClass} grid grid-cols-1 gap-3 sm:grid-cols-3`}>
        <Field label={t.session}>
          <select className={fieldClass} value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
            <option value="">{t.selectSession}</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {timeRange(s) ? ` (${localizeDigits(timeRange(s), lang)})` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t.class}>
          <select className={fieldClass} value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">{t.selectClass}</option>
            {classes.map((c) => (
              <option key={c.class_id} value={c.class_id}>
                {c.class_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t.date}>
          <input
            type="date"
            className={fieldClass}
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
      </div>

      {!sessionId || !classId ? (
        <div className={cardClass}>
          <EmptyRow text={t.pickAll} />
        </div>
      ) : loading ? (
        <div className={cardClass}>
          <SkeletonList items={6} />
        </div>
      ) : error ? (
        <ErrorState message={t.sheetFailed} onRetry={loadSheet} />
      ) : sheet ? (
        <div className={cardClass}>
          {offDay && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              <CalendarOff size={16} />
              {offDay}
            </div>
          )}
          {!offDay && sheet && !sheet.editable && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <Lock size={16} />
              {t.notEditable}
            </div>
          )}

          {students.length === 0 ? (
            <EmptyRow text={t.noStudents} />
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                  <span>
                    {t.counts.total}: <b>{n(students.length)}</b>
                  </span>
                  {ATTENDANCE_STATUSES.map((st) => (
                    <span key={st}>
                      {t.status[st]}: <b>{n(counts[st])}</b>
                    </span>
                  ))}
                  {counts.unmarked > 0 && (
                    <span className="text-rose-600 dark:text-rose-400">
                      {t.counts.unmarked}: <b>{n(counts.unmarked)}</b>
                    </span>
                  )}
                </div>
                {!readOnly && (
                  <div className="flex gap-2">
                    <Button variant="ghost" className="h-9 px-3" onClick={() => markAll(null)}>
                      {t.clearAll}
                    </Button>
                    <Button className="h-9 bg-emerald-600 px-3 hover:bg-emerald-500" onClick={() => markAll("PRESENT")}>
                      {t.allPresent}
                    </Button>
                  </div>
                )}
              </div>

              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {students.map((s) => {
                  const current = statusBy[s.student_id] ?? null;
                  return (
                    <li
                      key={s.student_id}
                      className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="w-10 shrink-0 text-sm font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                          {s.roll != null && s.roll !== "" ? localizeDigits(s.roll, lang) : "-"}
                        </span>
                        <span className="truncate text-sm text-slate-800 dark:text-slate-100">{s.name}</span>
                        {s.residency_type != null && (
                          <Badge tone={s.residency_type !== 1 ? "slate" : "purple"} className="shrink-0 !py-0.5">
                            {s.residency_type !== 1 ? t.nonResidential : t.residential}
                          </Badge>
                        )}
                      </div>
                      <div className="grid shrink-0 grid-cols-4 gap-1.5 sm:flex">
                        {ATTENDANCE_STATUSES.map((st) => (
                          <button
                            key={st}
                            type="button"
                            disabled={readOnly}
                            onClick={() => setStatus(s.student_id, st)}
                            title={t.status[st]}
                            aria-pressed={current === st}
                            className={`h-9 rounded-lg px-2 text-xs font-semibold ring-1 transition disabled:cursor-not-allowed sm:min-w-[64px] ${
                              current === st ? STATUS_STYLE[st].on : `bg-white dark:bg-slate-900 ${STATUS_STYLE[st].off}`
                            } ${readOnly && current !== st ? "opacity-50" : ""}`}
                          >
                            {t.status[st]}
                          </button>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {!readOnly && (
                <div className="sticky bottom-0 -mx-4 -mb-4 mt-3 flex flex-col gap-2 rounded-b-2xl border-t border-slate-100 bg-white/95 p-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:flex-row sm:items-center sm:justify-end">
                  {counts.unmarked > 0 && (
                    <span className="text-xs text-amber-700 dark:text-amber-400 sm:me-auto">
                      {t.unmarkedWarn(n(counts.unmarked))}
                    </span>
                  )}
                  <Button onClick={save} disabled={saving || counts.marked === 0 || !dirty} className="h-10 sm:min-w-[160px]">
                    {saving ? t.saving : t.save}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* =============================================================== manage */

const emptyForm = (): SessionPayload => ({
  name: "",
  start_time: "",
  end_time: "",
  residential_only: false,
  is_active: true,
});

function ManageTab({
  sessions,
  loading,
  reload,
}: {
  sessions: AttendanceSession[];
  loading: boolean;
  reload: () => Promise<void> | void;
}) {
  const t = useText(attendanceSessionText);
  const m = t.manage;
  const c = useText(commonText);
  const lang = useLang();

  const [editing, setEditing] = useState<AttendanceSession | "new" | null>(null);
  const [form, setForm] = useState<SessionPayload>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<{ session: AttendanceSession; hasRecords: boolean } | null>(null);

  const openNew = () => {
    setForm(emptyForm());
    setEditing("new");
  };
  const openEdit = (s: AttendanceSession) => {
    setForm({
      name: s.name,
      start_time: s.start_time?.slice(0, 5) ?? "",
      end_time: s.end_time?.slice(0, 5) ?? "",
      residential_only: s.residential_only,
      is_active: s.is_active,
      sort_order: s.sort_order,
    });
    setEditing(s);
  };

  const submit = async () => {
    const tx = getText(attendanceSessionText).manage;
    if (!form.name.trim()) return toast(tx.nameRequired, "error");
    const payload: SessionPayload = {
      ...form,
      name: form.name.trim(),
      start_time: form.start_time || null,
      end_time: form.end_time || null,
    };
    setSaving(true);
    try {
      if (editing === "new") {
        const maxOrder = sessions.reduce((mx, s) => Math.max(mx, s.sort_order ?? 0), 0);
        await sessionApi.create({ ...payload, sort_order: payload.sort_order ?? maxOrder + 1 });
        toast(tx.created, "success");
      } else if (editing) {
        await sessionApi.update(editing.id, payload);
        toast(tx.updated, "success");
      }
      setEditing(null);
      await reload();
    } catch {
      // interceptor toast
    } finally {
      setSaving(false);
    }
  };

  const patch = async (s: AttendanceSession, body: Partial<SessionPayload>, msg?: string) => {
    setBusyId(s.id);
    try {
      await sessionApi.update(s.id, body);
      if (msg) toast(msg, "success");
      await reload();
    } catch {
      // interceptor toast
    } finally {
      setBusyId(null);
    }
  };

  // Swap sort_order with the neighbour; renumber when orders collide.
  const move = async (index: number, dir: -1 | 1) => {
    const other = sessions[index + dir];
    const cur = sessions[index];
    if (!other || !cur) return;
    setBusyId(cur.id);
    try {
      const a = cur.sort_order ?? index;
      const b = other.sort_order ?? index + dir;
      const [newCur, newOther] = a === b ? [index + dir, index] : [b, a];
      await Promise.all([
        sessionApi.update(cur.id, { sort_order: newCur }),
        sessionApi.update(other.id, { sort_order: newOther }),
      ]);
      await reload();
    } catch {
      // interceptor toast
    } finally {
      setBusyId(null);
    }
  };

  const doDelete = async (force: boolean) => {
    if (!deleting) return;
    const tx = getText(attendanceSessionText).manage;
    const s = deleting.session;
    setBusyId(s.id);
    try {
      await sessionApi.remove(s.id, force, { silent: !force });
      toast(tx.deleted, "success");
      setDeleting(null);
      await reload();
    } catch (err: any) {
      if (!force && (err?.response?.status === 409 || apiErrorCode(err) === "has_records")) {
        setDeleting({ session: s, hasRecords: true });
      } else if (!force) {
        toast(err?.response?.data?.message || getText(commonText).deleteFailed, "error");
        setDeleting(null);
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={openNew}>
          <Plus size={16} className="me-1" />
          {m.add}
        </Button>
      </div>

      {loading && sessions.length === 0 ? (
        <div className={cardClass}>
          <SkeletonList items={4} />
        </div>
      ) : sessions.length === 0 ? (
        <div className={cardClass}>
          <EmptyRow text={t.noSessions} />
        </div>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s, i) => (
            <li
              key={s.id}
              className={`${cardClass} flex flex-col gap-3 !py-3 sm:flex-row sm:items-center sm:justify-between ${
                s.is_active ? "" : "opacity-70"
              } ${busyId === s.id ? "animate-pulse" : ""}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex flex-col">
                  <button
                    type="button"
                    disabled={i === 0 || busyId !== null}
                    onClick={() => move(i, -1)}
                    className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 dark:hover:bg-slate-800"
                    aria-label={m.moveUp}
                    title={m.moveUp}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    disabled={i === sessions.length - 1 || busyId !== null}
                    onClick={() => move(i, 1)}
                    className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 dark:hover:bg-slate-800"
                    aria-label={m.moveDown}
                    title={m.moveDown}
                  >
                    <ArrowDown size={16} />
                  </button>
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{s.name}</span>
                    {s.residential_only && <Badge tone="purple">{t.residential}</Badge>}
                    {!s.is_active && <Badge tone="slate">{m.inactive}</Badge>}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {timeRange(s) ? localizeDigits(timeRange(s), lang) : m.allDay}
                    {s.record_count != null && ` · ${m.records(formatNumber(s.record_count, lang))}`}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={s.is_active}
                    disabled={busyId !== null}
                    onChange={(e) => patch(s, { is_active: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                  {m.active}
                </label>
                <Button variant="secondary" className="h-9 px-3" onClick={() => openEdit(s)}>
                  <Pencil size={15} className="me-1" />
                  {c.edit}
                </Button>
                <Button
                  variant="ghost"
                  className="h-9 px-3 text-rose-600 dark:text-rose-400"
                  onClick={() => setDeleting({ session: s, hasRecords: (s.record_count ?? 0) > 0 })}
                  aria-label={m.delete}
                  title={m.delete}
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <Modal open title={editing === "new" ? m.add : m.edit} onClose={saving ? () => undefined : () => setEditing(null)}>
          <div className="space-y-4">
            <Field label={m.name}>
              <input
                className={fieldClass}
                value={form.name}
                placeholder={m.namePlaceholder}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={m.start}>
                <input
                  type="time"
                  className={fieldClass}
                  value={form.start_time ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                />
              </Field>
              <Field label={m.end}>
                <input
                  type="time"
                  className={fieldClass}
                  value={form.end_time ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                />
              </Field>
            </div>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={!!form.residential_only}
                onChange={(e) => setForm((f) => ({ ...f, residential_only: e.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              <span>
                {m.residentialOnly}
                <span className="block text-xs text-slate-500 dark:text-slate-400">{m.residentialOnlyHint}</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={form.is_active !== false}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              {m.active}
            </label>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
                {m.cancel}
              </Button>
              <Button onClick={submit} disabled={saving || !form.name.trim()}>
                {saving ? t.saving : m.save}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {deleting && (
        <Modal
          open
          title={deleting.hasRecords ? m.hasRecordsTitle : m.deleteTitle}
          onClose={busyId !== null ? () => undefined : () => setDeleting(null)}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {deleting.hasRecords ? m.hasRecordsMessage : m.deleteMessage(deleting.session.name)}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeleting(null)} disabled={busyId !== null}>
                {m.cancel}
              </Button>
              {deleting.hasRecords ? (
                <>
                  {deleting.session.is_active && (
                    <Button
                      disabled={busyId !== null}
                      onClick={async () => {
                        const s = deleting.session;
                        setDeleting(null);
                        await patch(s, { is_active: false }, getText(attendanceSessionText).manage.deactivated);
                      }}
                    >
                      {m.deactivateInstead}
                    </Button>
                  )}
                  <Button variant="danger" disabled={busyId !== null} onClick={() => doDelete(true)}>
                    {m.forceDelete}
                  </Button>
                </>
              ) : (
                <Button variant="danger" disabled={busyId !== null} onClick={() => doDelete(false)}>
                  {m.delete}
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* =============================================================== report */

function ReportTab({ sessions, classes }: { sessions: AttendanceSession[]; classes: ClassOption[] }) {
  const t = useText(attendanceSessionText);
  const r = t.report;
  const lang = useLang();
  const n = (v: number) => formatNumber(v, lang);

  const [from, setFrom] = useState(monthStartIso());
  const [to, setTo] = useState(localIso());
  const [classId, setClassId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [data, setData] = useState<SessionReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    setError(false);
    try {
      setData(
        await sessionApi.report({
          from,
          to,
          class_id: classId ? Number(classId) : undefined,
          session_id: sessionId ? Number(sessionId) : undefined,
        }),
      );
    } catch {
      setError(true);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, classId, sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  const cols = useMemo(() => sortSessions(data?.sessions ?? []), [data]);
  const rows = useMemo(
    () =>
      (data?.rows ?? [])
        .slice()
        .sort(
          (a, b) =>
            String(a.class_name ?? "").localeCompare(String(b.class_name ?? "")) ||
            Number(a.roll ?? 1e9) - Number(b.roll ?? 1e9),
        ),
    [data],
  );

  return (
    <div className="space-y-4">
      <div className={`${cardClass} grid grid-cols-2 gap-3 md:grid-cols-4`}>
        <Field label={r.from}>
          <input type="date" className={fieldClass} value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label={r.to}>
          <input type="date" className={fieldClass} value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label={t.class}>
          <select className={fieldClass} value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">{t.allClasses}</option>
            {classes.map((c) => (
              <option key={c.class_id} value={c.class_id}>
                {c.class_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t.session}>
          <select className={fieldClass} value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
            <option value="">{t.allSessions}</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {loading && !data ? (
        <div className={cardClass}>
          <SkeletonTable rows={6} />
        </div>
      ) : error ? (
        <ErrorState message={r.failed} onRetry={load} />
      ) : rows.length === 0 ? (
        <div className={cardClass}>
          <EmptyRow text={r.empty} />
        </div>
      ) : (
        <div className={`${cardClass} overflow-x-auto !p-0 ${loading ? "opacity-60" : ""}`}>
          <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className={`${thClass} sticky start-0 bg-slate-50 dark:bg-slate-800`}>{r.name}</th>
                <th className={thClass}>{r.roll}</th>
                {cols.map((s) => (
                  <th key={s.id} className={`${thClass} text-center`}>
                    {s.name}
                  </th>
                ))}
                <th className={`${thClass} min-w-[150px]`}>{r.overall}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((row) => (
                <tr key={row.student_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className={`${tdClass} sticky start-0 bg-white dark:bg-slate-900`}>
                    <div className="font-medium">{row.name}</div>
                    {row.class_name && !classId && (
                      <div className="text-xs text-slate-400 dark:text-slate-500">{row.class_name}</div>
                    )}
                  </td>
                  <td className={`${tdClass} tabular-nums`}>
                    {row.roll != null && row.roll !== "" ? localizeDigits(row.roll, lang) : "-"}
                  </td>
                  {cols.map((s) => {
                    const c = row.per_session?.[String(s.id)];
                    if (!c || !c.total) {
                      return (
                        <td key={s.id} className={`${tdClass} text-center text-slate-300 dark:text-slate-600`}>
                          —
                        </td>
                      );
                    }
                    const pct = Number(c.percentage) || 0;
                    return (
                      <td
                        key={s.id}
                        className={`${tdClass} text-center tabular-nums`}
                        title={r.cellTitle(n(c.PRESENT ?? 0), n(c.LATE ?? 0), n(c.ABSENT ?? 0), n(c.LEAVE ?? 0))}
                      >
                        <span
                          className={`font-semibold ${
                            pct >= 90
                              ? "text-emerald-600 dark:text-emerald-400"
                              : pct >= 75
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {localizeDigits(formatPercent(pct), lang)}%
                        </span>
                        <div className="text-[11px] text-slate-400">
                          {n((c.PRESENT ?? 0) + (c.LATE ?? 0))}/{n(c.total)}
                        </div>
                      </td>
                    );
                  })}
                  <td className={tdClass}>
                    <RateBar rate={row.overall_percentage} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
