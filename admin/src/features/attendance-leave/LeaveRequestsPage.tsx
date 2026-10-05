import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, Plus, RefreshCw, Search, X, Ban } from "lucide-react";

import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import Badge, { type BadgeTone } from "@madrasha/shared-ui/src/components/ui/Badge";
import ErrorState from "@madrasha/shared-ui/src/components/ui/ErrorState";
import { SkeletonList } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { formatDate, formatNumber, getText, useLang, useText } from "@madrasha/shared-ui/src/i18n";

import { useAuthStore } from "../../store/authStore";
import { hasPermission } from "../../utils/permissions";
import {
  ATTENDEE_TYPES,
  LEAVE_STATUSES,
  LEAVE_TYPES,
  leaveApi,
  loadAllClasses,
  loadPeople,
  localIso,
  type AttendeeType,
  type ClassOption,
  type LeaveRequest,
  type LeaveStatus,
  type LeaveType,
  type PersonOption,
} from "../../services/attendanceV3Api";
import { EmptyRow, Field, Tabs, cardClass, fieldClass } from "../attendance-analytics/shared";
import { attendanceLeaveText } from "./attendanceLeave.text";

type TabKey = LeaveStatus | "ALL";
type ActionKind = "approve" | "reject" | "cancel";

const PAGE_SIZE = 20;
const TAB_KEYS: TabKey[] = [...LEAVE_STATUSES, "ALL"];

const STATUS_TONE: Record<LeaveStatus, BadgeTone> = {
  PENDING: "yellow",
  APPROVED: "green",
  REJECTED: "red",
  CANCELLED: "slate",
};

const toast = (msg: string, type: "success" | "error" | "info" = "info") => useToastStore.getState().show(msg, type);

export default function LeaveRequestsPage() {
  const t = useText(attendanceLeaveText);
  const lang = useLang();
  const n = (v: number) => formatNumber(v, lang);
  const fmt = (d: string | null | undefined) =>
    d ? formatDate(d, lang, { day: "numeric", month: "short", year: "numeric" }) : "";

  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const canManage = hasPermission(user, permissions, "attendance.leave");

  const [tab, setTab] = useState<TabKey>("PENDING");
  const [attendeeType, setAttendeeType] = useState<AttendeeType | "">("");
  const [leaveType, setLeaveType] = useState<LeaveType | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<LeaveRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [action, setAction] = useState<{ kind: ActionKind; item: LeaveRequest } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const filters = { attendee_type: attendeeType, from, to };
      const [list, pending] = await Promise.all([
        leaveApi.list(
          { ...filters, status: tab === "ALL" ? "" : tab, page, limit: PAGE_SIZE },
          { silent: true },
        ),
        leaveApi.list({ ...filters, status: "PENDING", page: 1, limit: 1 }, { silent: true }).catch(() => null),
      ]);
      setItems(list.items);
      setTotal(list.total);
      setPendingCount(pending ? pending.total : null);
    } catch {
      setError(true);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [tab, attendeeType, from, to, page]);

  useEffect(() => {
    load();
  }, [load]);

  // leave_type isn't a server filter - narrow the current page client-side.
  const visible = useMemo(
    () => (leaveType ? items.filter((i) => i.leave_type === leaveType) : items),
    [items, leaveType],
  );

  const resetFilters = () => {
    setAttendeeType("");
    setLeaveType("");
    setFrom("");
    setTo("");
    setPage(1);
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl p-3 sm:p-4 md:p-6">
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <>
            <Button variant="secondary" onClick={load} disabled={loading} title={t.refresh}>
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </Button>
            {canManage && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus size={16} className="me-1" />
                {t.newLeave}
              </Button>
            )}
          </>
        }
      />

      <Tabs
        tabs={TAB_KEYS.map((key) => ({
          key,
          label: t.tabs[key],
          count: key === "PENDING" ? pendingCount : null,
        }))}
        value={tab}
        onChange={(key) => {
          setTab(key);
          setPage(1);
        }}
      />

      {/* Filters */}
      <div className={`${cardClass} mb-4 grid grid-cols-2 gap-3 md:grid-cols-5`}>
        <Field label={t.filters.attendeeType}>
          <select
            className={fieldClass}
            value={attendeeType}
            onChange={(e) => {
              setAttendeeType(e.target.value as AttendeeType | "");
              setPage(1);
            }}
          >
            <option value="">{t.filters.all}</option>
            {ATTENDEE_TYPES.map((type) => (
              <option key={type} value={type}>
                {t.attendeeTypes[type]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t.filters.leaveType}>
          <select
            className={fieldClass}
            value={leaveType}
            onChange={(e) => setLeaveType(e.target.value as LeaveType | "")}
          >
            <option value="">{t.filters.all}</option>
            {LEAVE_TYPES.map((type) => (
              <option key={type} value={type}>
                {t.leaveTypes[type]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t.filters.from}>
          <input
            type="date"
            className={fieldClass}
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </Field>
        <Field label={t.filters.to}>
          <input
            type="date"
            className={fieldClass}
            value={to}
            min={from || undefined}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </Field>
        <div className="col-span-2 flex items-end md:col-span-1">
          <Button variant="ghost" className="h-10 w-full" onClick={resetFilters}>
            {t.filters.reset}
          </Button>
        </div>
      </div>

      {/* List */}
      {loading && items.length === 0 ? (
        <div className={cardClass}>
          <SkeletonList items={5} />
        </div>
      ) : error ? (
        <ErrorState message={t.loadFailed} onRetry={load} />
      ) : visible.length === 0 ? (
        <div className={cardClass}>
          <EmptyRow text={t.empty} />
        </div>
      ) : (
        <div className={`space-y-3 ${loading ? "opacity-60" : ""}`}>
          {visible.map((item) => (
            <LeaveCard
              key={item.id}
              item={item}
              canManage={canManage}
              fmt={fmt}
              onAction={(kind) => setAction({ kind, item })}
            />
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600 dark:text-slate-400">
          <span>
            {t.pageInfo(n((page - 1) * PAGE_SIZE + 1), n(Math.min(page * PAGE_SIZE, total)), n(total))}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
              {t.prev}
            </Button>
            <Button
              variant="secondary"
              disabled={page >= pageCount || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              {t.next}
            </Button>
          </div>
        </div>
      )}

      {createOpen && (
        <CreateLeaveModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            load();
          }}
        />
      )}

      {action && (
        <ActionModal
          kind={action.kind}
          item={action.item}
          onClose={() => setAction(null)}
          onDone={() => {
            setAction(null);
            load();
          }}
        />
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- card */

function LeaveCard({
  item,
  canManage,
  fmt,
  onAction,
}: {
  item: LeaveRequest;
  canManage: boolean;
  fmt: (d: string | null | undefined) => string;
  onAction: (kind: ActionKind) => void;
}) {
  const t = useText(attendanceLeaveText);
  const lang = useLang();
  const via = item.requested_via === "guardian" ? t.via.guardian : t.via.office;
  const sameDay = item.from_date === item.to_date;

  return (
    <article className={`${cardClass} flex flex-col gap-3 md:flex-row md:items-start md:justify-between`}>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{item.attendee_name}</h3>
          <Badge tone="slate">{t.attendeeTypes[item.attendee_type] ?? item.attendee_type}</Badge>
          <Badge tone={STATUS_TONE[item.status] ?? "slate"}>{t.status[item.status] ?? item.status}</Badge>
          <Badge tone={item.requested_via === "guardian" ? "purple" : "blue"}>{via}</Badge>
        </div>
        {(item.class_name || item.roll != null) && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {item.class_name}
            {item.class_name && item.roll != null ? " · " : ""}
            {item.roll != null && item.roll !== "" ? `${t.roll}: ${formatNumber(item.roll as any, lang)}` : ""}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-700 dark:text-slate-200">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays size={15} className="text-slate-400" />
            {sameDay ? fmt(item.from_date) : `${fmt(item.from_date)} - ${fmt(item.to_date)}`}
          </span>
          <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
            {t.days(formatNumber(item.days ?? 0, lang))}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {t.leaveTypes[item.leave_type] ?? item.leave_type}
          </span>
        </div>
        {item.reason && (
          <p className="whitespace-pre-line break-words text-sm text-slate-600 dark:text-slate-300">
            <span className="font-medium text-slate-500 dark:text-slate-400">{t.reason}: </span>
            {item.reason}
          </p>
        )}
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {item.requested_by_name ? `${t.requestedBy}: ${item.requested_by_name} · ` : ""}
          {fmt(item.created_at)}
          {item.reviewed_by_name ? ` · ${t.reviewedBy}: ${item.reviewed_by_name}` : ""}
          {item.reviewed_at ? ` (${fmt(item.reviewed_at)})` : ""}
        </p>
        {item.review_note && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {t.reviewNote}: {item.review_note}
          </p>
        )}
      </div>

      {canManage && (item.status === "PENDING" || item.status === "APPROVED") && (
        <div className="flex shrink-0 flex-wrap gap-2 md:flex-col">
          {item.status === "PENDING" && (
            <>
              <Button className="flex-1 md:flex-none" onClick={() => onAction("approve")}>
                <Check size={16} className="me-1" />
                {t.actions.approve}
              </Button>
              <Button variant="danger" className="flex-1 md:flex-none" onClick={() => onAction("reject")}>
                <X size={16} className="me-1" />
                {t.actions.reject}
              </Button>
            </>
          )}
          <Button variant="secondary" className="flex-1 md:flex-none" onClick={() => onAction("cancel")}>
            <Ban size={16} className="me-1" />
            {t.actions.cancel}
          </Button>
        </div>
      )}
    </article>
  );
}

/* --------------------------------------------------------- action modal */

function ActionModal({
  kind,
  item,
  onClose,
  onDone,
}: {
  kind: ActionKind;
  item: LeaveRequest;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useText(attendanceLeaveText);
  const lang = useLang();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const noteRequired = kind === "reject";

  const submit = async () => {
    const trimmed = note.trim();
    if (noteRequired && !trimmed) {
      toast(t.noteRequired, "error");
      return;
    }
    setBusy(true);
    try {
      const tx = getText(attendanceLeaveText);
      if (kind === "approve") {
        const res = await leaveApi.approve(item.id, trimmed || undefined);
        toast(
          tx.approved(formatNumber(res?.days_marked ?? 0, lang), formatNumber(res?.days_skipped ?? 0, lang)),
          "success",
        );
      } else if (kind === "reject") {
        await leaveApi.reject(item.id, trimmed);
        toast(tx.rejected, "success");
      } else {
        await leaveApi.cancel(item.id, trimmed || undefined);
        toast(tx.cancelled, "success");
      }
      onDone();
    } catch {
      // the api interceptor already showed the server's message
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open title={t.actionTitle[kind]} onClose={busy ? () => undefined : onClose}>
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
          <p className="font-semibold text-slate-800 dark:text-slate-100">{item.attendee_name}</p>
          <p className="text-slate-600 dark:text-slate-300">
            {formatDate(item.from_date, lang, { day: "numeric", month: "short" })} -{" "}
            {formatDate(item.to_date, lang, { day: "numeric", month: "short", year: "numeric" })} ·{" "}
            {t.days(formatNumber(item.days ?? 0, lang))}
          </p>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">{t.actionHint[kind]}</p>
        <Field label={noteRequired ? `${t.note} *` : t.noteOptional}>
          <textarea
            className={`${fieldClass} h-24 py-2`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            autoFocus
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t.close}
          </Button>
          <Button
            variant={kind === "approve" ? "primary" : "danger"}
            onClick={submit}
            disabled={busy || (noteRequired && !note.trim())}
          >
            {busy ? t.working : t.actions[kind]}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* --------------------------------------------------------- create modal */

const MAX_RESULTS = 30;

function CreateLeaveModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const t = useText(attendanceLeaveText);
  const c = t.create;
  const lang = useLang();
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const canApprove = hasPermission(user, permissions, "attendance.leave");

  const [type, setType] = useState<AttendeeType>("STUDENT");
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classId, setClassId] = useState("");
  const [query, setQuery] = useState("");
  const [person, setPerson] = useState<PersonOption | null>(null);

  const today = localIso();
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [leaveType, setLeaveType] = useState<LeaveType>("sick");
  const [reason, setReason] = useState("");
  const [approveNow, setApproveNow] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAllClasses()
      .then(setClasses)
      .catch(() => setClasses([]));
  }, []);

  useEffect(() => {
    let alive = true;
    setPeopleLoading(true);
    setPerson(null);
    loadPeople(type)
      .then((rows) => alive && setPeople(rows))
      .catch(() => alive && setPeople([]))
      .finally(() => alive && setPeopleLoading(false));
    return () => {
      alive = false;
    };
  }, [type]);

  const classNameById = useMemo(() => new Map(classes.map((cl) => [cl.class_id, cl.class_name])), [classes]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter((p) => {
      if (type === "STUDENT" && classId && String(p.class_id) !== classId) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        String(p.id) === q ||
        (p.roll != null && String(p.roll) === q) ||
        (p.extra ? String(p.extra).toLowerCase().includes(q) : false)
      );
    });
  }, [people, query, classId, type]);

  const describe = (p: PersonOption) => {
    const bits: string[] = [];
    if (type === "STUDENT" && p.class_id != null) bits.push(classNameById.get(p.class_id) ?? "");
    if (p.roll != null && p.roll !== "") bits.push(`${t.roll}: ${formatNumber(p.roll as any, lang)}`);
    if (type !== "STUDENT" && p.extra) bits.push(String(p.extra));
    bits.push(`#${formatNumber(p.id, lang).replace(/[,٬]/g, "")}`);
    return bits.filter(Boolean).join(" · ");
  };

  const submit = async () => {
    if (!person) return toast(c.missingPerson, "error");
    if (!reason.trim()) return toast(c.missingReason, "error");
    if (toDate < fromDate) return toast(c.badRange, "error");
    setSaving(true);
    try {
      await leaveApi.create({
        attendee_type: type,
        attendee_id: person.id,
        from_date: fromDate,
        to_date: toDate,
        leave_type: leaveType,
        reason: reason.trim(),
        approve_now: canApprove && approveNow ? true : undefined,
      });
      toast(getText(attendanceLeaveText).create.created, "success");
      onCreated();
    } catch {
      // the api interceptor toasts the server's message; keep the modal open
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title={c.title} onClose={saving ? () => undefined : onClose} maxWidthClassName="max-w-2xl">
      <div className="space-y-4">
        <div>
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{c.attendeeType}</span>
          <div className="grid grid-cols-3 gap-2">
            {ATTENDEE_TYPES.map((tp) => (
              <button
                key={tp}
                type="button"
                onClick={() => {
                  setType(tp);
                  setClassId("");
                  setQuery("");
                }}
                className={`h-10 rounded-lg text-sm font-medium transition ${
                  type === tp
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {t.attendeeTypes[tp]}
              </button>
            ))}
          </div>
        </div>

        {person ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-900 dark:bg-indigo-950/30">
            <div className="min-w-0">
              <p className="text-xs text-indigo-600 dark:text-indigo-300">{c.selected}</p>
              <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{person.name}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{describe(person)}</p>
            </div>
            <Button variant="secondary" onClick={() => setPerson(null)}>
              {c.change}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {type === "STUDENT" && (
                <select className={fieldClass} value={classId} onChange={(e) => setClassId(e.target.value)}>
                  <option value="">{c.allClasses}</option>
                  {classes.map((cl) => (
                    <option key={cl.class_id} value={cl.class_id}>
                      {cl.class_name}
                    </option>
                  ))}
                </select>
              )}
              <div className={`relative ${type === "STUDENT" ? "sm:col-span-2" : "sm:col-span-3"}`}>
                <Search size={16} className="pointer-events-none absolute start-3 top-3 text-slate-400" />
                <input
                  className={`${fieldClass} ps-9`}
                  placeholder={c.search}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
              {peopleLoading ? (
                <EmptyRow text={c.peopleLoading} />
              ) : matches.length === 0 ? (
                <EmptyRow text={c.noPeople} />
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {matches.slice(0, MAX_RESULTS).map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setPerson(p)}
                        className="flex w-full flex-col items-start px-3 py-2 text-start hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{p.name}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{describe(p)}</span>
                      </button>
                    </li>
                  ))}
                  {matches.length > MAX_RESULTS && (
                    <li className="px-3 py-2 text-center text-xs text-slate-400">
                      {c.moreResults(formatNumber(matches.length - MAX_RESULTS, lang))}
                    </li>
                  )}
                </ul>
              )}
            </div>
            <p className="text-xs text-slate-400">{c.pickPerson}</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label={c.from}>
            <input
              type="date"
              className={fieldClass}
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                if (toDate < e.target.value) setToDate(e.target.value);
              }}
            />
          </Field>
          <Field label={c.to}>
            <input
              type="date"
              className={fieldClass}
              value={toDate}
              min={fromDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </Field>
          <Field label={c.leaveType}>
            <select className={fieldClass} value={leaveType} onChange={(e) => setLeaveType(e.target.value as LeaveType)}>
              {LEAVE_TYPES.map((lt) => (
                <option key={lt} value={lt}>
                  {t.leaveTypes[lt]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label={c.reason}>
          <textarea
            className={`${fieldClass} h-20 py-2`}
            placeholder={c.reasonPlaceholder}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>

        {canApprove && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={approveNow}
              onChange={(e) => setApproveNow(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            {c.approveNow}
          </label>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t.close}
          </Button>
          <Button onClick={submit} disabled={saving || !person || !reason.trim()}>
            {saving ? c.submitting : c.submit}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
