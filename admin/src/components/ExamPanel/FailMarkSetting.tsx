import { Check, Pencil, X } from "lucide-react";
import { useEffect, useState } from "react";
import api from "../../services/api";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { toBanglaDigits } from "@madrasha/shared-ui/src/utils/reportUtils";
import { useAuthStore } from "../../store/authStore";
import { hasPermission } from "../../utils/permissions";
import RecalculateResultsModal from "../ResultPanel/RecalculateResultsModal";
import { RESULT_PERMISSIONS } from "../ResultPanel/resultStatus";

export default function FailMarkSetting({
  value,
  reload,
}: {
  value: number;
  reload: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const [draft, setDraft] = useState(String(value));
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [reviewPublishedOpen, setReviewPublishedOpen] = useState(false);

  const canRecalculate =
    hasPermission(user, permissions, RESULT_PERMISSIONS.resultProcess) ||
    hasPermission(user, permissions, RESULT_PERMISSIONS.legacyFallback);

  useEffect(() => {
    if (!isEditing) setDraft(String(value));
  }, [value, isEditing]);

  const cancelEdit = () => {
    setDraft(String(value));
    setIsEditing(false);
  };

  const update = async () => {
    const failMark = Number(draft);
    if (draft.trim() === "" || !Number.isFinite(failMark) || failMark < 0 || failMark > 100) {
      return useToastStore.getState().show("০ থেকে ১০০ এর মধ্যে ফেল মার্ক দিন", "error");
    }

    try {
      setIsSaving(true);
      const res = await api.post("/fail-mark", { value: failMark });
      const toast = useToastStore.getState().show;
      // The server re-grades every unpublished result right after saving,
      // and only COUNTS published/locked ones (fail mark is one global
      // setting - applying it to results guardians already saw is a
      // deliberate choice, offered below).
      const recalc = res.data?.recalculation as
        | { ok: boolean; updated: number; pending_published: number; failed: number }
        | undefined;

      if (recalc && !recalc.ok) {
        toast(
          "ফেল মার্ক সংরক্ষিত হয়েছে, কিন্তু ফলাফল হালনাগাদ করা যায়নি — রেজাল্ট পেজ বা গ্রেড পেজ থেকে 'পুনঃগণনা' চাপুন",
          "error",
        );
      } else if (recalc && recalc.updated > 0) {
        toast(`আপডেট হয়েছে — ${toBanglaDigits(recalc.updated)}টি অপ্রকাশিত ফলাফল নতুন ফেল মার্কে হালনাগাদ হয়েছে`, "success");
      } else {
        toast("আপডেট হয়েছে!", "success");
      }

      if (recalc?.ok && recalc.pending_published > 0) {
        if (canRecalculate) {
          setReviewPublishedOpen(true);
        } else {
          toast(
            `${toBanglaDigits(recalc.pending_published)}টি প্রকাশিত ফলাফল এখনো পুরনো ফেল মার্কে আছে — তালিমাত পুনঃগণনা করলে হালনাগাদ হবে`,
            "info",
          );
        }
      }

      setIsEditing(false);
      reload();
    } catch {
      useToastStore.getState().show("আপডেট করা যায়নি", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">ফেল মার্ক</h2>

        {!isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="ফেল মার্ক পরিবর্তন করুন"
            title="ফেল মার্ক পরিবর্তন করুন"
          >
            <Pencil size={17} />
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <input
            type="number"
            min={0}
            max={100}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
          />

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={update}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Check size={17} />
              {isSaving ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <X size={17} />
              বাতিল
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-center dark:border-slate-700 dark:bg-slate-800">
          <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">{value}</span>
          <span className="ml-1 text-sm text-slate-500 dark:text-slate-400">নম্বর</span>
        </div>
      )}

      <p className="text-xs text-slate-500 dark:text-slate-400">
        ফেল মার্ক বদলালে অপ্রকাশিত ফলাফল নিজে থেকে হালনাগাদ হয়। প্রকাশিত ফলাফলে প্রয়োগ করবেন কি না, সংরক্ষণের পর আপনাকে
        জিজ্ঞেস করা হবে।
      </p>

      <RecalculateResultsModal
        open={reviewPublishedOpen}
        onClose={() => setReviewPublishedOpen(false)}
      />
    </div>
  );
}
