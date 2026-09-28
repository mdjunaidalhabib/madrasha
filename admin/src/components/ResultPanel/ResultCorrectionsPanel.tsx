import { useCallback, useEffect, useState } from "react";
import api from "../../services/api";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import { commonText, formatDate, getLang, getText, localizeDigits, useText } from "@madrasha/shared-ui/src/i18n";
import { resultPanelText } from "./resultPanel.text";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import ReasonPromptModal from "./ReasonPromptModal";
import { correctionStatusBadge } from "./resultStatus";

interface CorrectionRow {
  id: number;
  student_id: number | null;
  book_id: number | null;
  field: string;
  old_value: string | null;
  new_value: string | null;
  reason: string;
  status: string;
  requested_at: string | null;
  decided_at: string | null;
  decision_note: string | null;
}

interface StudentRef {
  student_id: number;
  name_bn: string;
}

interface BookRef {
  book_id: number;
  book_name?: string;
  book_name_bn?: string;
  name_bn?: string;
}

interface Props {
  resultMasterId: number;
  students: StudentRef[];
  books: BookRef[];
  /** Holder of result.approve (or legacy result.manage) - may approve/reject. */
  canDecide: boolean;
  /** Bumped by the parent after it submits a new request, to reload the list. */
  reloadKey: number;
  /** Called after an approve actually changed live data, so the parent can
   * reload the result table. */
  onApplied: () => void;
}

// Display labels only - `field` values are backend keys.
const fieldLabel = (field: string) => getText(resultPanelText).corrections.fields[field] || field;

const booleanLabel = (field: string, value: string): string | undefined => {
  const t = getText(resultPanelText).corrections;
  const labels: Record<string, Record<string, string>> = {
    is_absent: { true: t.absent, false: t.present },
    is_exempted: { true: t.yes, false: t.no },
    is_withheld: { true: t.yes, false: t.no },
  };
  return labels[field]?.[value];
};

const formatValue = (field: string, value: string | null) => {
  if (value === null || value === "") return "—";
  const boolLabel = booleanLabel(field, value);
  if (boolLabel) return boolLabel;
  return /^-?\d+(\.\d+)?$/.test(value) ? localizeDigits(value, getLang()) : value;
};

const formatWhen = (iso: string | null) => {
  if (!iso) return "";
  return formatDate(iso, getLang(), { day: "2-digit", month: "2-digit", year: "numeric" });
};

/** Lists every correction request filed against a PUBLISHED/LOCKED result and
 * lets an approver apply or reject the pending ones. The backend only ever
 * mutates live marks on an explicit approve (see
 * result-correction.service.ts's decide()), so this is the second half of the
 * "সংশোধন" flow whose first half is the student edit modal. */
export default function ResultCorrectionsPanel({
  resultMasterId,
  students,
  books,
  canDecide,
  reloadKey,
  onApplied,
}: Props) {
  const push = useToastStore((state) => state.push);
  const t = useText(resultPanelText).corrections;
  const c = useText(commonText);
  const num = (value: number | string) => localizeDigits(value, getLang());
  const [rows, setRows] = useState<CorrectionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [decidingId, setDecidingId] = useState<number | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/results/${resultMasterId}/corrections`);
      setRows(Array.isArray(res.data?.data) ? res.data.data : []);
      setForbidden(false);
    } catch (err: any) {
      logger.error("Load corrections error:", err);
      setRows([]);
      setForbidden(err?.response?.status === 403);
    } finally {
      setLoading(false);
    }
  }, [resultMasterId]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const studentName = (id: number | null) =>
    students.find((s) => s.student_id === id)?.name_bn || (id ? t.studentFallback(num(id)) : "—");

  const bookName = (id: number | null) => {
    if (!id) return "—";
    const b = books.find((x) => x.book_id === id);
    return b?.book_name_bn || b?.name_bn || b?.book_name || t.bookFallback(num(id));
  };

  const decide = async (id: number, approve: boolean, note?: string) => {
    try {
      setDecidingId(id);
      await api.post(`/results/corrections/${id}/decide`, {
        approve,
        ...(note ? { decision_note: note } : {}),
      });
      push("success", approve ? t.applied : t.rejected);
      await load();
      if (approve) onApplied();
    } catch (err: any) {
      logger.error("Decide correction error:", err);
      push("error", err?.response?.data?.message || t.decideFailed);
      await load();
    } finally {
      setDecidingId(null);
      setRejectId(null);
    }
  };

  const handleApprove = (row: CorrectionRow) => {
    useConfirmStore.getState().show({
      title: t.approveTitle,
      message: t.approveMessage(
        studentName(row.student_id),
        bookName(row.book_id),
        fieldLabel(row.field),
        formatValue(row.field, row.old_value),
        formatValue(row.field, row.new_value),
      ),
      confirmText: t.approveConfirm,
      onConfirm: () => decide(row.id, true),
    });
  };

  if (forbidden) return null;

  const pendingCount = rows.filter((r) => r.status === "PENDING").length;
  const visible = showAll ? rows : rows.filter((r) => r.status === "PENDING");

  return (
    <div className="bg-white shadow-md rounded-xl p-3 sm:p-4 mt-4 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-base sm:text-lg font-semibold dark:text-slate-100">{t.title}</h2>
          <p className="text-xs text-gray-500 mt-1 dark:text-slate-400">
            {t.subtitle}
          </p>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-slate-400 cursor-pointer">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          {t.showAll(num(rows.length))}
        </label>
      </div>

      {loading && rows.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center dark:text-slate-500">{c.loading}</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center dark:text-slate-500">
          {rows.length === 0
            ? t.noneYet
            : pendingCount === 0
              ? t.nonePending
              : ""}
        </p>
      ) : (
        <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
          <table className="w-full min-w-[720px] border text-xs sm:text-sm dark:border-slate-800">
            <thead className="bg-gray-100 dark:bg-slate-800">
              <tr>
                <th className="border px-2 py-2 text-start dark:border-slate-800">{t.student}</th>
                <th className="border px-2 py-2 text-start dark:border-slate-800">{t.subject}</th>
                <th className="border px-2 py-2 text-start dark:border-slate-800">{t.field}</th>
                <th className="border px-2 py-2 text-center dark:border-slate-800">{t.beforeAfter}</th>
                <th className="border px-2 py-2 text-start dark:border-slate-800">{t.reason}</th>
                <th className="border px-2 py-2 text-center dark:border-slate-800">{t.state}</th>
                {canDecide && <th className="border px-2 py-2 text-center dark:border-slate-800">{t.actions}</th>}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const badge = correctionStatusBadge(r.status);
                const pending = r.status === "PENDING";
                return (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                    <td className="border px-2 py-2 dark:border-slate-800">{studentName(r.student_id)}</td>
                    <td className="border px-2 py-2 dark:border-slate-800">{bookName(r.book_id)}</td>
                    <td className="border px-2 py-2 dark:border-slate-800">{fieldLabel(r.field)}</td>
                    <td className="border px-2 py-2 text-center whitespace-nowrap dark:border-slate-800">
                      {formatValue(r.field, r.old_value)} → <b>{formatValue(r.field, r.new_value)}</b>
                    </td>
                    <td className="border px-2 py-2 break-words dark:border-slate-800">
                      {r.reason}
                      {r.decision_note ? (
                        <div className="text-[11px] text-gray-500 dark:text-slate-400">{t.decision(r.decision_note)}</div>
                      ) : null}
                      <div className="text-[11px] text-gray-400 dark:text-slate-500">{formatWhen(r.requested_at)}</div>
                    </td>
                    <td className="border px-2 py-2 text-center dark:border-slate-800">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    {canDecide && (
                      <td className="border px-2 py-2 text-center dark:border-slate-800">
                        {pending ? (
                          <div className="flex gap-1.5 justify-center">
                            <button
                              onClick={() => handleApprove(r)}
                              disabled={decidingId === r.id}
                              className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:bg-gray-400"
                            >
                              {t.approve}
                            </button>
                            <button
                              onClick={() => setRejectId(r.id)}
                              disabled={decidingId === r.id}
                              className="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:bg-gray-400"
                            >
                              {t.reject}
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400 dark:text-slate-500">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ReasonPromptModal
        open={rejectId !== null}
        title={t.rejectTitle}
        message={t.rejectMessage}
        label={t.rejectLabel}
        confirmText={t.rejectConfirm}
        loading={decidingId !== null}
        onCancel={() => setRejectId(null)}
        onConfirm={(reason) => rejectId !== null && decide(rejectId, false, reason)}
      />
    </div>
  );
}
