import { useCallback, useEffect, useState } from "react";
import api from "../../services/api";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { toBanglaDigits } from "@madrasha/shared-ui/src/utils/reportUtils";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { resultStatusBadge } from "./resultStatus";

type Outcome = "UPDATED" | "WOULD_UPDATE" | "UNCHANGED" | "SKIPPED" | "FAILED";

interface RecalcRow {
  result_master_id: number;
  exam_name: string;
  class_name: string;
  status: string;
  is_published: boolean;
  outcome: Outcome;
  skip_reason?: "NOT_PROCESSED" | "INCOMPLETE_MARKS";
  changed_students: number;
  total_students: number;
}

interface RecalcTotals {
  updated: number;
  failed: number;
  pending_unpublished: number;
  pending_published: number;
  changed_students: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Recalculate just this session. Omit to review every processed session. */
  resultMasterId?: number | null;
  /** Called after changes were actually applied, so the caller can reload. */
  onApplied?: () => void;
}

/** The পুনঃগণনা review-then-apply dialog. It always starts with a dry run so
 * তালিমাত sees exactly which sessions and how many students would change
 * before anything is written - fail mark is one global setting, so applying
 * a new value is never a blind operation. Unpublished sessions are safe to
 * refresh; PUBLISHED/LOCKED ones need the explicit checkbox (guardians may
 * already have seen them). A single-session dialog skips that checkbox: the
 * user picked that session on purpose. */
export default function RecalculateResultsModal({ open, onClose, resultMasterId, onApplied }: Props) {
  const push = useToastStore((state) => state.push);
  const single = Boolean(resultMasterId);

  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [rows, setRows] = useState<RecalcRow[]>([]);
  const [totals, setTotals] = useState<RecalcTotals | null>(null);
  const [includePublished, setIncludePublished] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const review = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const res = await api.post("/results/recalculate", {
        ...(resultMasterId ? { result_master_id: resultMasterId } : {}),
        include_published: true,
        dry_run: true,
      });
      setRows(Array.isArray(res.data?.results) ? res.data.results : []);
      setTotals(res.data?.totals ?? null);
    } catch (err: any) {
      logger.error("Recalculate review error:", err);
      setLoadError(true);
      push("error", err?.response?.data?.message || "পুনঃগণনার তথ্য আনা যায়নি");
    } finally {
      setLoading(false);
    }
  }, [resultMasterId, push]);

  useEffect(() => {
    if (!open) return;
    setIncludePublished(false);
    setRows([]);
    setTotals(null);
    review();
  }, [open, review]);

  const affected = rows.filter((r) => r.outcome === "WOULD_UPDATE");
  const affectedUnpublished = affected.filter((r) => !r.is_published);
  const affectedPublished = affected.filter((r) => r.is_published);
  const skippedIncomplete = rows.filter((r) => r.skip_reason === "INCOMPLETE_MARKS");

  const willApply = single || includePublished ? affected : affectedUnpublished;
  const studentsToChange = willApply.reduce((sum, r) => sum + r.changed_students, 0);

  const handleApply = async () => {
    try {
      setApplying(true);
      const res = await api.post("/results/recalculate", {
        ...(resultMasterId ? { result_master_id: resultMasterId } : {}),
        include_published: single || includePublished,
      });
      const applied: RecalcTotals | undefined = res.data?.totals;
      const failed = applied?.failed ?? 0;

      push(
        failed > 0 ? "error" : "success",
        failed > 0
          ? `${toBanglaDigits(applied?.updated ?? 0)}টি ফলাফল হালনাগাদ হয়েছে, ${toBanglaDigits(failed)}টি ব্যর্থ হয়েছে`
          : `${toBanglaDigits(applied?.updated ?? 0)}টি ফলাফল পুনঃগণনা হয়েছে (${toBanglaDigits(applied?.changed_students ?? 0)} জন শিক্ষার্থীর ফলাফল বদলেছে)`,
      );
      onApplied?.();
      onClose();
    } catch (err: any) {
      logger.error("Recalculate apply error:", err);
      push("error", err?.response?.data?.message || "পুনঃগণনা করা যায়নি");
    } finally {
      setApplying(false);
    }
  };

  const nothingToDo = !loading && !loadError && affected.length === 0;

  return (
    <Modal
      open={open}
      title={single ? "🔄 ফলাফল পুনঃগণনা" : "🔄 সব ফলাফল পুনঃগণনা"}
      onClose={applying ? () => undefined : onClose}
      maxWidthClassName="max-w-2xl"
    >
      <div className="space-y-4 text-sm text-gray-700 dark:text-slate-300">
        <p className="text-xs text-gray-500 dark:text-slate-400">
          বর্তমান ফেল মার্ক, গ্রেড সীমা ও বিষয়ের সেটিং অনুযায়ী ফলাফল নতুন করে হিসাব করা হবে। নম্বর নিজে বদলাবে না — শুধু
          মোট, গড়, গ্রেড, পাস/ফেল ও মেধাক্রম হালনাগাদ হবে।
        </p>

        {loading && <p className="py-6 text-center text-gray-400 dark:text-slate-500">যাচাই করা হচ্ছে...</p>}

        {loadError && !loading && (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-red-50 p-3 text-red-700 dark:bg-red-950/40 dark:text-red-400">
            <span>তথ্য আনা যায়নি।</span>
            <Button variant="secondary" onClick={review}>
              আবার চেষ্টা করুন
            </Button>
          </div>
        )}

        {nothingToDo && (
          <div className="rounded-lg bg-emerald-50 p-4 text-center text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
            ✅ {single ? "এই ফলাফল" : "সব ফলাফল"} বর্তমান সেটিং অনুযায়ী ইতিমধ্যে হালনাগাদ আছে — কিছু বদলানোর নেই।
          </div>
        )}

        {affected.length > 0 && (
          <>
            <div className="overflow-x-auto rounded-lg border dark:border-slate-700">
              <table className="w-full min-w-[420px] text-xs sm:text-sm">
                <thead className="bg-gray-100 dark:bg-slate-800">
                  <tr>
                    <th className="px-3 py-2 text-left">পরীক্ষা / শ্রেণি</th>
                    <th className="px-3 py-2 text-center">অবস্থা</th>
                    <th className="px-3 py-2 text-center">বদলাবে</th>
                  </tr>
                </thead>
                <tbody>
                  {affected.map((r) => {
                    const badge = resultStatusBadge(r.status);
                    return (
                      <tr key={r.result_master_id} className="border-t dark:border-slate-700">
                        <td className="px-3 py-2">
                          {r.exam_name} — {r.class_name}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {toBanglaDigits(r.changed_students)} / {toBanglaDigits(r.total_students)} জন
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {affectedPublished.length > 0 && !single && (
              <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={includePublished}
                  onChange={(e) => setIncludePublished(e.target.checked)}
                />
                <span>
                  <b>প্রকাশিত/লকড ফলাফলেও প্রয়োগ করুন</b> ({toBanglaDigits(affectedPublished.length)}টি)। এগুলো
                  অভিভাবকরা আগেই দেখেছেন — শুধু নতুন নিয়ম আগের পরীক্ষাতেও কার্যকর করতে চাইলে টিক দিন। প্রয়োগ করলে প্রকাশিত
                  অবস্থা থাকবে এবং আগের/পরের রেকর্ড অডিটের জন্য সংরক্ষিত থাকবে।
                </span>
              </label>
            )}

            <ul className="list-disc space-y-1 pl-5 text-xs text-gray-500 dark:text-slate-400">
              {affectedUnpublished.length > 0 && (
                <li>
                  অপ্রকাশিত ফলাফল সরাসরি হালনাগাদ হবে। যাচাই/অনুমোদিত হয়ে থাকলে আবার "প্রসেসিং" অবস্থায় ফিরবে — প্রকাশের
                  সময় আপনার অধিকারে যাচাই ও অনুমোদন একসাথেই হয়ে যাবে।
                </li>
              )}
              {single && affectedPublished.length > 0 && (
                <li>এটি প্রকাশিত ফলাফল — আপনি নিজে এটি বেছে নিয়েছেন বলে প্রয়োগ হবে; প্রকাশিত অবস্থা বজায় থাকবে।</li>
              )}
            </ul>
          </>
        )}

        {skippedIncomplete.length > 0 && (
          <p className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600 dark:bg-slate-800 dark:text-slate-400">
            ⚠️ {toBanglaDigits(skippedIncomplete.length)}টি ফলাফলে সব নম্বর পূর্ণ নেই বলে বাদ দেওয়া হয়েছে:{" "}
            {skippedIncomplete.map((r) => `${r.exam_name} — ${r.class_name}`).join("; ")}
          </p>
        )}

        {totals && totals.failed > 0 && (
          <p className="text-xs text-red-600 dark:text-red-400">
            {toBanglaDigits(totals.failed)}টি ফলাফল যাচাই করা যায়নি।
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={applying}>
            {nothingToDo ? "বন্ধ করুন" : "বাতিল"}
          </Button>
          {affected.length > 0 && (
            <Button onClick={handleApply} disabled={applying || loading || willApply.length === 0}>
              {applying
                ? "হচ্ছে..."
                : `প্রয়োগ করুন (${toBanglaDigits(willApply.length)}টি ফলাফল, ${toBanglaDigits(studentsToChange)} জন)`}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
