import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, HandCoins, CircleCheck } from "lucide-react";
import { libraryBorrowApi } from "../../services/phase2Api";
import { useToastStore } from "../../store/toastStore";
import { logger } from "../../utils/logger";
import { SkeletonList } from "../../components/ui/Skeleton";

type BorrowRecord = {
  id: number;
  dueDate: string;
  returnedAt: string | null;
  status: "BORROWED" | "RETURNED" | "LOST";
  daysOverdue: number;
  estimatedFine: number;
  fineAmount: string | number;
  fineSettled: boolean;
  book?: { id: number; title: string; author?: string | null } | null;
  student?: { id: number; nameBn: string; roll?: number } | null;
  teacher?: { id: number; nameBn: string } | null;
};

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

const borrowerLabel = (record: BorrowRecord) =>
  record.student ? `${record.student.nameBn}${record.student.roll ? ` (রোল ${record.student.roll})` : ""}` : record.teacher?.nameBn || "-";

const LibraryOverdueFinesPage = () => {
  const [tab, setTab] = useState<"overdue" | "unsettled">("overdue");
  const [overdueRecords, setOverdueRecords] = useState<BorrowRecord[]>([]);
  const [unsettledRecords, setUnsettledRecords] = useState<BorrowRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [settlingId, setSettlingId] = useState<number | null>(null);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [overdueRes, unsettledRes] = await Promise.all([
        libraryBorrowApi.list({ overdue_only: true }),
        libraryBorrowApi.list({ unsettled_fine_only: true }),
      ]);
      setOverdueRecords(normalizeArray(overdueRes));
      setUnsettledRecords(normalizeArray(unsettledRes));
    } catch (err) {
      logger.error("LOAD OVERDUE/FINES ERROR:", err);
      setOverdueRecords([]);
      setUnsettledRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleSettle = async (record: BorrowRecord) => {
    if (!window.confirm(`৳${record.fineAmount} জরিমানা মিটিয়ে দেওয়া হয়েছে বলে চিহ্নিত করবেন?`)) return;
    try {
      setSettlingId(record.id);
      await libraryBorrowApi.settleFine(record.id);
      useToastStore.getState().show("জরিমানা মিটিয়ে দেওয়া হয়েছে", "success");
      loadAll();
    } finally {
      setSettlingId(null);
    }
  };

  const activeList = tab === "overdue" ? overdueRecords : unsettledRecords;

  return (
    <div className="min-h-screen bg-gray-50 p-3 dark:bg-slate-950 sm:p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 sm:text-2xl">মেয়াদোত্তীর্ণ ও জরিমানা</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">বিলম্বিত বই এবং বকেয়া জরিমানা দেখুন ও মিটিয়ে দিন</p>
        </div>

        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setTab("overdue")}
            className={`flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium ${
              tab === "overdue" ? "border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400" : "border-gray-300 text-gray-600 dark:border-slate-700 dark:text-slate-300"
            }`}
          >
            <AlertTriangle size={14} />
            বর্তমানে বিলম্বিত ({overdueRecords.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("unsettled")}
            className={`flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium ${
              tab === "unsettled" ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" : "border-gray-300 text-gray-600 dark:border-slate-700 dark:text-slate-300"
            }`}
          >
            <HandCoins size={14} />
            বকেয়া জরিমানা ({unsettledRecords.length})
          </button>
        </div>

        <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
          {loading ? (
            <SkeletonList items={4} />
          ) : activeList.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500 dark:text-slate-400">
              <CircleCheck size={28} className="mx-auto mb-2 text-emerald-400" />
              {tab === "overdue" ? "কোনো বই বিলম্বিত নেই" : "কোনো বকেয়া জরিমানা নেই"}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {activeList.map((record) => (
                <div
                  key={record.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 px-2.5 py-2 text-sm dark:border-slate-800"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-gray-800 dark:text-slate-100">{record.book?.title}</span>
                      <span className="text-xs text-gray-500 dark:text-slate-400">— {borrowerLabel(record)}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-gray-400 dark:text-slate-500">
                      ফেরতের তারিখ: {new Date(record.dueDate).toLocaleDateString("bn-BD")}
                      {tab === "overdue" ? (
                        <span className="font-medium text-rose-600 dark:text-rose-400">
                          {" "}
                          · {record.daysOverdue} দিন বিলম্বিত · আনুমানিক জরিমানা ৳{record.estimatedFine}
                        </span>
                      ) : (
                        <span className="font-medium text-amber-600 dark:text-amber-400"> · জরিমানা ৳{record.fineAmount}</span>
                      )}
                    </div>
                  </div>
                  {tab === "unsettled" && (
                    <button
                      type="button"
                      disabled={settlingId === record.id}
                      onClick={() => handleSettle(record)}
                      className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-emerald-200 px-2.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                    >
                      <HandCoins size={13} />
                      মিটিয়ে দিন
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LibraryOverdueFinesPage;
