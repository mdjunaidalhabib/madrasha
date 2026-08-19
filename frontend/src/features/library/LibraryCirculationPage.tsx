import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, X, BookPlus, Undo2, AlertTriangle, ShieldAlert } from "lucide-react";
import { cachedGet } from "../../services/api";
import { libraryBookApi, libraryBorrowApi } from "../../services/phase2Api";
import { useToastStore } from "../../store/toastStore";
import Modal from "../../components/ui/Modal";
import { logger } from "../../utils/logger";
import { SkeletonList } from "../../components/ui/Skeleton";

type PersonOption = { id: number; name_bn?: string; roll?: number; registration_no?: number | string | null };

type LibraryBookOption = { id: number; title: string; author?: string | null; copiesAvailable: number };

type BorrowRecord = {
  id: number;
  bookId: number;
  studentId: number | null;
  teacherId: number | null;
  borrowedAt: string;
  dueDate: string;
  status: "BORROWED" | "RETURNED" | "LOST";
  daysOverdue: number;
  estimatedFine: number;
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

const emptyIssueForm = { book_id: "", due_date: "", notes: "" };

const LibraryCirculationPage = () => {
  const [allStudents, setAllStudents] = useState<PersonOption[]>([]);
  const [allTeachers, setAllTeachers] = useState<PersonOption[]>([]);
  const [books, setBooks] = useState<LibraryBookOption[]>([]);

  const [records, setRecords] = useState<BorrowRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [borrowerType, setBorrowerType] = useState<"student" | "teacher">("student");
  const [borrowerQuery, setBorrowerQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedBorrower, setSelectedBorrower] = useState<PersonOption | null>(null);
  const [issueForm, setIssueForm] = useState(emptyIssueForm);
  const [issuing, setIssuing] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  const [returnTarget, setReturnTarget] = useState<BorrowRecord | null>(null);
  const [returning, setReturning] = useState(false);

  const loadRecords = useCallback(async () => {
    try {
      setRecordsLoading(true);
      const res = await libraryBorrowApi.list({ status: "BORROWED" });
      setRecords(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD BORROW RECORDS ERROR:", err);
      setRecords([]);
    } finally {
      setRecordsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    (async () => {
      try {
        const [studentsRes, teachersRes] = await Promise.all([
          cachedGet("/students"),
          cachedGet("/teachers"),
        ]);
        setAllStudents(normalizeArray(studentsRes));
        setAllTeachers(normalizeArray(teachersRes));
      } catch (err) {
        logger.error("LOAD STUDENTS/TEACHERS ERROR:", err);
      }
    })();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const borrowerSuggestions = useMemo(() => {
    const q = borrowerQuery.trim().toLowerCase();
    if (!q) return [];
    const pool = borrowerType === "student" ? allStudents : allTeachers;
    return pool
      .filter((p) => {
        const name = (p.name_bn || "").toLowerCase();
        const roll = String(p.roll ?? "");
        const regNo = String(p.registration_no ?? "");
        return name.includes(q) || roll.includes(q) || regNo.includes(q) || String(p.id) === q;
      })
      .slice(0, 8);
  }, [allStudents, allTeachers, borrowerType, borrowerQuery]);

  const openIssueModal = async () => {
    setBorrowerType("student");
    setBorrowerQuery("");
    setSelectedBorrower(null);
    setIssueForm(emptyIssueForm);
    setIssueModalOpen(true);
    try {
      const res = await libraryBookApi.list({ available_only: true });
      setBooks(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD AVAILABLE BOOKS ERROR:", err);
      setBooks([]);
    }
  };

  const handleIssue = async () => {
    if (!selectedBorrower) {
      useToastStore.getState().show("প্রথমে একজন ছাত্র/শিক্ষক নির্বাচন করুন", "error");
      return;
    }
    if (!issueForm.book_id) {
      useToastStore.getState().show("বই নির্বাচন করুন", "error");
      return;
    }
    try {
      setIssuing(true);
      await libraryBorrowApi.issue({
        book_id: Number(issueForm.book_id),
        [borrowerType === "student" ? "student_id" : "teacher_id"]: selectedBorrower.id,
        due_date: issueForm.due_date || undefined,
        notes: issueForm.notes.trim() || undefined,
      });
      useToastStore.getState().show("বই ইস্যু করা হয়েছে", "success");
      setIssueModalOpen(false);
      loadRecords();
    } finally {
      setIssuing(false);
    }
  };

  const handleReturn = async () => {
    if (!returnTarget) return;
    try {
      setReturning(true);
      await libraryBorrowApi.return(returnTarget.id);
      useToastStore.getState().show("বই ফেরত নেওয়া হয়েছে", "success");
      setReturnTarget(null);
      loadRecords();
    } finally {
      setReturning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 dark:bg-slate-950 sm:p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 sm:text-2xl">ইস্যু ও ফেরত</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">বই ইস্যু করুন এবং বর্তমান ধারকৃত বই ফেরত নিন</p>
          </div>
          <button
            type="button"
            onClick={openIssueModal}
            className="flex h-9 items-center gap-1.5 rounded-md bg-blue-600 px-3.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <BookPlus size={15} />
            বই ইস্যু করুন
          </button>
        </div>

        <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
          {recordsLoading ? (
            <SkeletonList items={4} />
          ) : records.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500 dark:text-slate-400">
              বর্তমানে কোনো বই ধারে দেওয়া নেই
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {records.map((record) => {
                const overdue = record.daysOverdue > 0;
                return (
                  <div
                    key={record.id}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-sm ${
                      overdue ? "border-rose-200 bg-rose-50/60 dark:border-rose-900/50 dark:bg-rose-950/20" : "border-gray-100 dark:border-slate-800"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-gray-800 dark:text-slate-100">{record.book?.title}</span>
                        <span className="text-xs text-gray-500 dark:text-slate-400">— {borrowerLabel(record)}</span>
                        {overdue && (
                          <span className="flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
                            <AlertTriangle size={10} />
                            {record.daysOverdue} দিন বিলম্বিত
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-gray-400 dark:text-slate-500">
                        ফেরতের তারিখ: {new Date(record.dueDate).toLocaleDateString("bn-BD")}
                        {overdue && (
                          <span className="font-medium text-rose-600 dark:text-rose-400"> · আনুমানিক জরিমানা ৳{record.estimatedFine}</span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReturnTarget(record)}
                      className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-emerald-200 px-2.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                    >
                      <Undo2 size={13} />
                      ফেরত নিন
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Issue modal */}
      <Modal open={issueModalOpen} title="বই ইস্যু করুন" onClose={() => setIssueModalOpen(false)} maxWidthClassName="max-w-lg">
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setBorrowerType("student");
                setSelectedBorrower(null);
                setBorrowerQuery("");
              }}
              className={`h-8 flex-1 rounded-md border text-xs font-medium ${
                borrowerType === "student" ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" : "border-gray-300 text-gray-600 dark:border-slate-700 dark:text-slate-300"
              }`}
            >
              ছাত্র
            </button>
            <button
              type="button"
              onClick={() => {
                setBorrowerType("teacher");
                setSelectedBorrower(null);
                setBorrowerQuery("");
              }}
              className={`h-8 flex-1 rounded-md border text-xs font-medium ${
                borrowerType === "teacher" ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" : "border-gray-300 text-gray-600 dark:border-slate-700 dark:text-slate-300"
              }`}
            >
              শিক্ষক
            </button>
          </div>

          <div ref={searchBoxRef} className="relative">
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
              {borrowerType === "student" ? "ছাত্র" : "শিক্ষক"} নির্বাচন করুন *
            </label>
            {selectedBorrower ? (
              <div className="flex items-center justify-between rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-slate-700">
                <span className="text-gray-800 dark:text-slate-100">
                  {selectedBorrower.name_bn}
                  {selectedBorrower.roll ? ` (রোল ${selectedBorrower.roll})` : ""}
                </span>
                <button type="button" onClick={() => setSelectedBorrower(null)} className="text-gray-400 hover:text-gray-700">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={borrowerQuery}
                  onChange={(e) => {
                    setBorrowerQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="নাম, রোল বা আইডি দিয়ে খুঁজুন"
                  className="h-9 w-full rounded-md border border-gray-300 pl-8 pr-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                {showSuggestions && borrowerQuery.trim() && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                    {borrowerSuggestions.length === 0 ? (
                      <div className="px-3 py-3 text-center text-sm text-gray-400 dark:text-slate-500">কেউ পাওয়া যায়নি</div>
                    ) : (
                      borrowerSuggestions.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedBorrower(p);
                            setBorrowerQuery("");
                            setShowSuggestions(false);
                          }}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-slate-700"
                        >
                          <span className="text-gray-800 dark:text-slate-200">{p.name_bn}</span>
                          <span className="text-xs text-gray-400 dark:text-slate-500">{p.roll ? `রোল ${p.roll}` : p.registration_no ? `রেজি ${p.registration_no}` : ""}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">বই নির্বাচন করুন *</label>
            <select
              value={issueForm.book_id}
              onChange={(e) => setIssueForm((f) => ({ ...f, book_id: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">নির্বাচন করুন</option>
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.title} {book.author ? `— ${book.author}` : ""} ({book.copiesAvailable} কপি আছে)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
              ফেরতের শেষ তারিখ (ঐচ্ছিক, না দিলে ডিফল্ট ব্যবহৃত হবে)
            </label>
            <input
              type="date"
              value={issueForm.due_date}
              onChange={(e) => setIssueForm((f) => ({ ...f, due_date: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">নোট (ঐচ্ছিক)</label>
            <textarea
              value={issueForm.notes}
              onChange={(e) => setIssueForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setIssueModalOpen(false)}
            className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            বাতিল
          </button>
          <button
            type="button"
            disabled={issuing}
            onClick={handleIssue}
            className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {issuing ? "সংরক্ষণ হচ্ছে..." : "ইস্যু নিশ্চিত করুন"}
          </button>
        </div>
      </Modal>

      {/* Return confirm modal */}
      <Modal open={!!returnTarget} title="বই ফেরত নিন" onClose={() => setReturnTarget(null)}>
        {returnTarget && (
          <div className="flex flex-col gap-2 text-sm">
            <p className="text-gray-700 dark:text-slate-300">
              <span className="font-medium">{returnTarget.book?.title}</span> — {borrowerLabel(returnTarget)}
            </p>
            {returnTarget.daysOverdue > 0 ? (
              <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400">
                <ShieldAlert size={16} />
                <span>
                  {returnTarget.daysOverdue} দিন বিলম্বিত — আনুমানিক জরিমানা <strong>৳{returnTarget.estimatedFine}</strong>
                </span>
              </div>
            ) : (
              <p className="text-emerald-600 dark:text-emerald-400">সময়মতো ফেরত — কোনো জরিমানা নেই</p>
            )}
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setReturnTarget(null)}
            className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            বাতিল
          </button>
          <button
            type="button"
            disabled={returning}
            onClick={handleReturn}
            className="h-9 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {returning ? "সংরক্ষণ হচ্ছে..." : "ফেরত নিশ্চিত করুন"}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default LibraryCirculationPage;
