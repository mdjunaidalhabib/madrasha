import { useEffect, useState } from "react";
import api, { cachedGet } from "../../services/api";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { useAuthStore } from "../../store/authStore";
import { hasPermission } from "../../utils/permissions";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { correctionStatusBadge, RESULT_PERMISSIONS } from "./resultStatus";

interface Student {
  student_id: number;
  name_bn: string;
}
interface Book {
  book_id: number;
  book_name?: string;
  book_name_bn?: string;
}
interface Correction {
  id: number;
  student_id: number;
  book_id?: number | null;
  field: string;
  old_value?: string | number | null;
  new_value: string | number;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "APPLIED";
  requested_by?: string;
  requested_at?: string;
  decided_by?: string;
  decided_at?: string;
  decision_note?: string;
  applied_at?: string;
}

const MARK_FIELDS = [
  { value: "mark", label: "নম্বর" },
  { value: "is_absent", label: "অনুপস্থিত" },
  { value: "is_exempted", label: "মুক্ত" },
  { value: "is_withheld", label: "স্থগিত" },
  { value: "note", label: "নোট" },
];

const RESULT_FIELDS = [
  { value: "general_grade", label: "সাধারণ গ্রেড" },
  { value: "madrasa_grade", label: "মাদরাসা গ্রেড" },
  { value: "total", label: "মোট নম্বর" },
  { value: "average", label: "গড়" },
  { value: "status", label: "ফলাফল (PASS/FAIL)" },
  { value: "rank_no", label: "মেধাক্রম" },
];

const BOOLEAN_FIELDS = new Set(["is_absent", "is_exempted", "is_withheld"]);

const extractArray = (res: any) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  return [];
};

interface Props {
  resultMasterId: number;
}

/** Correction request form + history — only meaningful once a result is
 * PUBLISHED or LOCKED (the caller is responsible for only rendering this
 * for a row in one of those two states). */
export default function CorrectionPanel({ resultMasterId }: Props) {
  const push = useToastStore((state) => state.push);
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const canDecide =
    hasPermission(user, permissions, RESULT_PERMISSIONS.resultApprove) ||
    hasPermission(user, permissions, RESULT_PERMISSIONS.legacyFallback);

  const [students, setStudents] = useState<Student[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [loading, setLoading] = useState(false);
  const [deciding, setDeciding] = useState<number | null>(null);

  const [studentId, setStudentId] = useState("");
  const [field, setField] = useState("");
  const [bookId, setBookId] = useState("");
  const [newValue, setNewValue] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const needsBook = MARK_FIELDS.some((f) => f.value === field);

  const loadHistory = async () => {
    try {
      const res = await cachedGet(`/results/${resultMasterId}/corrections`, undefined, 0);
      setCorrections(extractArray(res.data));
    } catch (err) {
      logger.error("Load corrections error:", err);
      setCorrections([]);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await cachedGet(`/results/full-result?result_master_id=${resultMasterId}`);
        setStudents(extractArray(res.data?.students));
        setBooks(extractArray(res.data?.books));
      } catch (err) {
        logger.error("Load full-result for correction error:", err);
      }
      await loadHistory();
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultMasterId]);

  const resetForm = () => {
    setStudentId("");
    setField("");
    setBookId("");
    setNewValue("");
    setReason("");
  };

  const handleSubmit = async () => {
    if (!studentId) return push("error", "শিক্ষার্থী নির্বাচন করুন");
    if (!field) return push("error", "ফিল্ড নির্বাচন করুন");
    if (needsBook && !bookId) return push("error", "বিষয় নির্বাচন করুন");
    if (newValue.trim() === "") return push("error", "নতুন মান লিখুন");
    if (reason.trim() === "") return push("error", "কারণ লিখুন");

    setSubmitting(true);
    try {
      await api.post(`/results/${resultMasterId}/corrections`, {
        student_id: Number(studentId),
        ...(needsBook ? { book_id: Number(bookId) } : {}),
        field,
        new_value: newValue.trim(),
        reason: reason.trim(),
      });
      push("success", "সংশোধনীর অনুরোধ জমা হয়েছে");
      resetForm();
      await loadHistory();
    } catch (err: any) {
      logger.error("Create correction error:", err);
      push("error", err?.response?.data?.message || "অনুরোধ জমা করা যায়নি");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecide = async (correctionId: number, approve: boolean) => {
    setDeciding(correctionId);
    try {
      await api.post(`/results/corrections/${correctionId}/decide`, { approve });
      push("success", approve ? "সংশোধনী অনুমোদন করা হয়েছে" : "সংশোধনী বাতিল করা হয়েছে");
      await loadHistory();
    } catch (err: any) {
      logger.error("Decide correction error:", err);
      push("error", err?.response?.data?.message || "সিদ্ধান্ত জানানো যায়নি");
    } finally {
      setDeciding(null);
    }
  };

  const studentName = (sid: number) => students.find((s) => s.student_id === sid)?.name_bn || `#${sid}`;
  const bookLabel = (bid?: number | null) => {
    if (!bid) return null;
    const b = books.find((bk) => bk.book_id === bid);
    return b?.book_name_bn || b?.book_name || `বই #${bid}`;
  };
  const fieldLabel = (value: string) =>
    [...MARK_FIELDS, ...RESULT_FIELDS].find((f) => f.value === value)?.label || value;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200 p-4 dark:border-slate-700">
        <h4 className="mb-3 text-sm font-semibold text-gray-700 dark:text-slate-200">
          ✏️ সংশোধনীর অনুরোধ করুন
        </h4>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="rounded border p-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">শিক্ষার্থী নির্বাচন করুন</option>
            {students.map((s) => (
              <option key={s.student_id} value={s.student_id}>
                {s.name_bn}
              </option>
            ))}
          </select>

          <select
            value={field}
            onChange={(e) => {
              setField(e.target.value);
              setBookId("");
            }}
            className="rounded border p-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">ফিল্ড নির্বাচন করুন</option>
            <optgroup label="বিষয়ভিত্তিক">
              {MARK_FIELDS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="ফলাফলভিত্তিক">
              {RESULT_FIELDS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </optgroup>
          </select>

          {needsBook && (
            <select
              value={bookId}
              onChange={(e) => setBookId(e.target.value)}
              className="rounded border p-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">বিষয় নির্বাচন করুন</option>
              {books.map((b) => (
                <option key={b.book_id} value={b.book_id}>
                  {b.book_name_bn || b.book_name || `বই #${b.book_id}`}
                </option>
              ))}
            </select>
          )}

          {BOOLEAN_FIELDS.has(field) ? (
            <select
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="rounded border p-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">নতুন মান</option>
              <option value="true">হ্যাঁ</option>
              <option value="false">না</option>
            </select>
          ) : (
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="নতুন মান"
              className="rounded border p-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          )}

          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="কারণ লিখুন (আবশ্যক)"
            rows={2}
            className="sm:col-span-2 rounded border p-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="mt-3 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
          >
            {submitting ? "জমা হচ্ছে..." : "📨 অনুরোধ জমা দিন"}
          </button>
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold text-gray-700 dark:text-slate-200">সংশোধনীর ইতিহাস</h4>
        {loading ? (
          <p className="text-sm text-gray-400 dark:text-slate-500">লোড হচ্ছে...</p>
        ) : corrections.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-slate-500">কোনো সংশোধনীর অনুরোধ নেই</p>
        ) : (
          <div className="space-y-2">
            {corrections.map((c) => {
              const badgeInfo = correctionStatusBadge(c.status);
              return (
                <div
                  key={c.id}
                  className="rounded-lg border border-gray-200 p-3 text-sm dark:border-slate-700"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-gray-800 dark:text-slate-100">
                      {studentName(c.student_id)} — {fieldLabel(c.field)}
                      {bookLabel(c.book_id) ? ` (${bookLabel(c.book_id)})` : ""}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeInfo.className}`}>
                      {badgeInfo.label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                    {c.old_value ?? "—"} → <span className="font-semibold">{String(c.new_value)}</span>
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">কারণ: {c.reason}</p>
                  {c.requested_by && (
                    <p className="mt-1 text-[11px] text-gray-400 dark:text-slate-500">
                      অনুরোধ: {c.requested_by} {c.requested_at ? `— ${c.requested_at}` : ""}
                    </p>
                  )}

                  {c.status === "PENDING" && canDecide && (
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => handleDecide(c.id, true)}
                        disabled={deciding === c.id}
                        className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:bg-gray-400"
                      >
                        অনুমোদন
                      </button>
                      <button
                        onClick={() => handleDecide(c.id, false)}
                        disabled={deciding === c.id}
                        className="rounded bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:bg-gray-400"
                      >
                        বাতিল
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
