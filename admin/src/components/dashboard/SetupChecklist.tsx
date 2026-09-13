import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, Wallet, X } from "lucide-react";
import { cachedGet } from "../../services/api";
import Card from "@madrasha/shared-ui/src/components/ui/Card";

type ExamItem = {
  id: string | number;
  isActive: boolean;
  startDate?: string | null;
  endDate?: string | null;
  /** Whether a পরীক্ষার ফি FeeStructure is linked to this exam - see
   * ExamList.tsx / backend ExamRepository.findExams. */
  has_fee_link?: boolean;
};

const DISMISS_KEY = "setupChecklist.dismissedPendingCount";

const EXAM_SETTINGS_PATH = "/talimat/settings/exam";

/** "আসন্ন কার্যক্রম" pointer card for the dashboard - surfaces exams that
 * still need a date or still have a dormant fee, so admins discover the
 * annual-fee/exam disconnect from here instead of by accident. Reuses the
 * same /exams list ExamList.tsx already renders; no dedicated endpoint. */
export default function SetupChecklist() {
  const [exams, setExams] = useState<ExamItem[] | null>(null);
  const [dismissedCount, setDismissedCount] = useState<number>(() => {
    const raw = localStorage.getItem(DISMISS_KEY);
    return raw ? Number(raw) || 0 : 0;
  });

  useEffect(() => {
    let cancelled = false;
    cachedGet<ExamItem[]>("/exams")
      .then((res) => {
        if (!cancelled) setExams(res.data || []);
      })
      .catch(() => {
        // Dashboard tolerates a missing exam list - the card simply stays hidden.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!exams) return null;

  const needsDate = exams.filter((e) => !e.startDate && !e.endDate);
  const needsFeeActivation = exams.filter((e) => !e.isActive && e.has_fee_link);
  const totalPending = needsDate.length + needsFeeActivation.length;

  if (totalPending === 0) return null;
  if (dismissedCount >= totalPending) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(totalPending));
    setDismissedCount(totalPending);
  };

  return (
    <Card className="relative">
      <button
        onClick={dismiss}
        className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
        aria-label="বন্ধ করুন"
        title="বন্ধ করুন"
      >
        <X size={15} />
      </button>
      <h3 className="pr-8 text-sm font-bold text-slate-800 dark:text-slate-100">
        পরীক্ষা সেটআপ বাকি আছে
      </h3>
      <div className="mt-3 space-y-2">
        {needsDate.length > 0 && (
          <Link
            to={EXAM_SETTINGS_PATH}
            className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-800 transition hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-950/50"
          >
            <CalendarClock className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            {needsDate.length} টি পরীক্ষার তারিখ ঠিক করুন
          </Link>
        )}
        {needsFeeActivation.length > 0 && (
          <Link
            to={EXAM_SETTINGS_PATH}
            className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
          >
            <Wallet className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            {needsFeeActivation.length} টি পরীক্ষার ফি নিষ্ক্রিয় আছে
          </Link>
        )}
      </div>
    </Card>
  );
}
