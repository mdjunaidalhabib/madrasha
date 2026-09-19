import { useCallback, useEffect, useState } from "react";
import api from "../../services/api";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import { toBanglaDigits } from "@madrasha/shared-ui/src/utils/reportUtils";
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

const FIELD_LABELS: Record<string, string> = {
  mark: "নম্বর",
  is_absent: "অনুপস্থিতি",
  is_exempted: "অব্যাহতি",
  is_withheld: "স্থগিত",
  note: "মন্তব্য",
  general_grade: "সাধারণ গ্রেড",
  madrasa_grade: "মাদরাসা গ্রেড",
  total: "মোট",
  average: "গড়",
  status: "অবস্থা",
  rank_no: "মেধাক্রম",
};

const BOOLEAN_LABELS: Record<string, Record<string, string>> = {
  is_absent: { true: "অনুপস্থিত", false: "উপস্থিত" },
  is_exempted: { true: "হ্যাঁ", false: "না" },
  is_withheld: { true: "হ্যাঁ", false: "না" },
};

const formatValue = (field: string, value: string | null) => {
  if (value === null || value === "") return "—";
  const boolLabel = BOOLEAN_LABELS[field]?.[value];
  if (boolLabel) return boolLabel;
  return /^-?\d+(\.\d+)?$/.test(value) ? toBanglaDigits(value) : value;
};

const formatWhen = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : toBanglaDigits(d.toLocaleDateString("en-GB"));
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
    students.find((s) => s.student_id === id)?.name_bn || (id ? `শিক্ষার্থী #${toBanglaDigits(id)}` : "—");

  const bookName = (id: number | null) => {
    if (!id) return "—";
    const b = books.find((x) => x.book_id === id);
    return b?.book_name_bn || b?.name_bn || b?.book_name || `বিষয় #${toBanglaDigits(id)}`;
  };

  const decide = async (id: number, approve: boolean, note?: string) => {
    try {
      setDecidingId(id);
      await api.post(`/results/corrections/${id}/decide`, {
        approve,
        ...(note ? { decision_note: note } : {}),
      });
      push("success", approve ? "সংশোধন প্রয়োগ করা হয়েছে" : "সংশোধনের অনুরোধ প্রত্যাখ্যান করা হয়েছে");
      await load();
      if (approve) onApplied();
    } catch (err: any) {
      logger.error("Decide correction error:", err);
      push("error", err?.response?.data?.message || "সিদ্ধান্ত নেওয়া যায়নি");
      await load();
    } finally {
      setDecidingId(null);
      setRejectId(null);
    }
  };

  const handleApprove = (row: CorrectionRow) => {
    useConfirmStore.getState().show({
      title: "সংশোধন অনুমোদন করুন",
      message: `${studentName(row.student_id)} — ${bookName(row.book_id)}: ${FIELD_LABELS[row.field] || row.field} "${formatValue(row.field, row.old_value)}" থেকে "${formatValue(row.field, row.new_value)}" করা হবে। মোট, গড়, গ্রেড ও মেধাক্রম নতুন করে হিসাব হবে।`,
      confirmText: "অনুমোদন ও প্রয়োগ",
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
          <h2 className="text-base sm:text-lg font-semibold dark:text-slate-100">📝 ফলাফল সংশোধনের অনুরোধ</h2>
          <p className="text-xs text-gray-500 mt-1 dark:text-slate-400">
            প্রকাশিত ফলাফলে সরাসরি নম্বর বদলানো যায় না — "✏️ সংশোধন" চেপে অনুরোধ পাঠান, অনুমোদনের পর তা প্রয়োগ হবে।
          </p>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-slate-400 cursor-pointer">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          সব দেখান ({toBanglaDigits(rows.length)})
        </label>
      </div>

      {loading && rows.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center dark:text-slate-500">লোড হচ্ছে...</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center dark:text-slate-500">
          {rows.length === 0
            ? "এখনো কোনো সংশোধনের অনুরোধ নেই"
            : pendingCount === 0
              ? "কোনো অপেক্ষমান অনুরোধ নেই"
              : ""}
        </p>
      ) : (
        <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
          <table className="w-full min-w-[720px] border text-xs sm:text-sm dark:border-slate-800">
            <thead className="bg-gray-100 dark:bg-slate-800">
              <tr>
                <th className="border px-2 py-2 text-left dark:border-slate-800">শিক্ষার্থী</th>
                <th className="border px-2 py-2 text-left dark:border-slate-800">বিষয়</th>
                <th className="border px-2 py-2 text-left dark:border-slate-800">ক্ষেত্র</th>
                <th className="border px-2 py-2 text-center dark:border-slate-800">আগে → নতুন</th>
                <th className="border px-2 py-2 text-left dark:border-slate-800">কারণ</th>
                <th className="border px-2 py-2 text-center dark:border-slate-800">অবস্থা</th>
                {canDecide && <th className="border px-2 py-2 text-center dark:border-slate-800">কার্যক্রম</th>}
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
                    <td className="border px-2 py-2 dark:border-slate-800">{FIELD_LABELS[r.field] || r.field}</td>
                    <td className="border px-2 py-2 text-center whitespace-nowrap dark:border-slate-800">
                      {formatValue(r.field, r.old_value)} → <b>{formatValue(r.field, r.new_value)}</b>
                    </td>
                    <td className="border px-2 py-2 break-words dark:border-slate-800">
                      {r.reason}
                      {r.decision_note ? (
                        <div className="text-[11px] text-gray-500 dark:text-slate-400">সিদ্ধান্ত: {r.decision_note}</div>
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
                              অনুমোদন
                            </button>
                            <button
                              onClick={() => setRejectId(r.id)}
                              disabled={decidingId === r.id}
                              className="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:bg-gray-400"
                            >
                              প্রত্যাখ্যান
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
        title="সংশোধনের অনুরোধ প্রত্যাখ্যান"
        message="প্রত্যাখ্যান করলে ফলাফলে কোনো পরিবর্তন হবে না।"
        label="প্রত্যাখ্যানের কারণ"
        confirmText="প্রত্যাখ্যান করুন"
        loading={decidingId !== null}
        onCancel={() => setRejectId(null)}
        onConfirm={(reason) => rejectId !== null && decide(rejectId, false, reason)}
      />
    </div>
  );
}
