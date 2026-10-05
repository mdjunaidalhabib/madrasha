import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import { SkeletonList } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { commonText, formatDateTime, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import {
  attendanceApi,
  type AttendanceChangeItem,
  type AttendanceStatus,
  type AttendeeType,
} from "../../services/phase1Api";
import { attendanceText } from "./attendance.text";
import { ATTENDANCE_STATUSES, STATUS_STYLE, formatIsoDate } from "./attendanceUtils";

export function StatusBadge({ status }: { status: AttendanceStatus | null | undefined }) {
  const tx = useText(attendanceText);
  if (!status) {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        {tx.historyModal.none}
      </span>
    );
  }
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[status].badge}`}>
      {tx.common.status[status]}
    </span>
  );
}

/** Compact 4-way segmented control. */
export function StatusSegment({
  value,
  onChange,
  disabled,
}: {
  value: AttendanceStatus | null;
  onChange: (status: AttendanceStatus) => void;
  disabled?: boolean;
}) {
  const tx = useText(attendanceText);
  return (
    <div role="radiogroup" className="grid w-full grid-cols-4 gap-1 sm:w-auto">
      {ATTENDANCE_STATUSES.map((status) => {
        const on = value === status;
        return (
          <button
            key={status}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(status)}
            className={`h-8 min-w-0 rounded-lg border px-1.5 text-xs font-semibold transition sm:min-w-[64px] ${
              on
                ? STATUS_STYLE[status].on
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            } disabled:cursor-not-allowed ${on ? "disabled:opacity-80" : "disabled:opacity-40"}`}
          >
            {tx.common.status[status]}
          </button>
        );
      })}
    </div>
  );
}

/** Audit trail of one attendee (optionally one date). */
export function AttendanceHistoryModal({
  target,
  onClose,
}: {
  target: { attendeeType: AttendeeType; attendeeId: number; name: string; date?: string } | null;
  onClose: () => void;
}) {
  const lang = useLang();
  const tx = useText(attendanceText);
  const h = tx.historyModal;
  const [items, setItems] = useState<AttendanceChangeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!target) return;
    let alive = true;
    setLoading(true);
    setFailed(false);
    setItems([]);
    attendanceApi
      .history({ attendee_type: target.attendeeType, attendee_id: target.attendeeId, date: target.date })
      .then((rows) => alive && setItems(rows))
      .catch((err) => {
        logger.error("ATTENDANCE HISTORY ERROR:", err);
        if (alive) setFailed(true);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [target]);

  const sourceLabel = (s: string | null) => (s ? tx.common.source[s] || s : "");

  return (
    <Modal open={!!target} title={h.title(target?.name || "")} onClose={onClose} maxWidthClassName="max-w-lg">
      {loading ? (
        <SkeletonList items={3} />
      ) : failed ? (
        <p className="py-6 text-center text-sm text-rose-600 dark:text-rose-400">{h.loadFailed}</p>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">{h.empty}</p>
      ) : (
        <ol className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {formatIsoDate(item.date, lang)}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {h.via[item.via] || item.via}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <StatusBadge status={item.old_status} />
                {item.old_source && <span className="text-[11px] text-slate-400">({sourceLabel(item.old_source)})</span>}
                <ArrowRight size={14} className="text-slate-400 rtl:rotate-180" />
                {item.new_status ? (
                  <StatusBadge status={item.new_status} />
                ) : (
                  <span className="text-[11px] font-semibold text-slate-500">{h.removed}</span>
                )}
                {item.new_source && <span className="text-[11px] text-slate-400">({sourceLabel(item.new_source)})</span>}
              </div>
              {item.reason && (
                <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                  <span className="font-semibold">{h.reason}:</span> {item.reason}
                </p>
              )}
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                {h.by}: {item.changed_by_name || h.system} · {formatDateTime(item.changed_at, lang, { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}

/** Asks for the audit reason before saving a change that needs one. */
export function ReasonModal({
  open,
  saving,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  saving?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const tx = useText(attendanceText);
  const c = useText(commonText);
  const r = tx.reasonModal;
  const [reason, setReason] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("");
      setError(false);
    }
  }, [open]);

  const submit = () => {
    const value = reason.trim();
    if (!value) {
      setError(true);
      return;
    }
    onConfirm(value);
  };

  return (
    <Modal open={open} title={r.title} onClose={onCancel} maxWidthClassName="max-w-md">
      <p className="text-sm text-slate-600 dark:text-slate-300">{r.hint}</p>
      <textarea
        autoFocus
        rows={3}
        maxLength={500}
        value={reason}
        onChange={(e) => {
          setReason(e.target.value);
          if (error) setError(false);
        }}
        placeholder={r.placeholder}
        className={`mt-3 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 dark:bg-slate-800 dark:text-slate-100 ${
          error
            ? "border-rose-400 focus:ring-rose-500/30"
            : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/30 dark:border-slate-700"
        }`}
      />
      {error && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{r.required}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          {c.cancel}
        </Button>
        <Button onClick={submit} disabled={saving}>
          {saving ? tx.mark.saving : r.confirm}
        </Button>
      </div>
    </Modal>
  );
}
