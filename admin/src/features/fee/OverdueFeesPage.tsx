import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronUp } from "lucide-react";
import { invoiceApi } from "../../services/phase2Api";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { SkeletonList } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { toBanglaDigits } from "@madrasha/shared-ui/src/utils/reportUtils";

const PAGE_SIZES = [20, 50, 100];

type OverdueInvoiceRow = {
  id: number;
  title: string;
  dueDate: string;
  month: string | null;
  remaining: number;
};

type OverdueStudentRow = {
  studentId: number;
  studentName: string;
  roll: number | null;
  registrationNo: number | string | null;
  className: string | null;
  guardianPhone: string | null;
  totalDue: number;
  invoiceCount: number;
  oldestDueDate: string;
  invoices: OverdueInvoiceRow[];
};

const money = (value: number | string) => `৳${Number(value || 0).toLocaleString("bn-BD")}`;

const OverdueFeesPage = () => {
  const [students, setStudents] = useState<OverdueStudentRow[]>([]);
  const [totalDue, setTotalDue] = useState(0);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadRows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await invoiceApi.overdue();
      const data = (res as any)?.data?.data || (res as any)?.data || {};
      setStudents(Array.isArray(data.students) ? data.students : []);
      setTotalDue(Number(data.totalDue || 0));
    } catch (err) {
      logger.error("LOAD OVERDUE FEES ERROR:", err);
      setStudents([]);
      setTotalDue(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((row) => {
      const name = (row.studentName || "").toLowerCase();
      const roll = String(row.roll ?? "");
      const regNo = String(row.registrationNo ?? "").toLowerCase();
      const className = (row.className || "").toLowerCase();
      return name.includes(q) || roll.includes(q) || regNo.includes(q) || className.includes(q);
    });
  }, [students, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  useEffect(() => {
    setCurrentPage(1);
  }, [search, pageSize, students]);
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginatedRows = useMemo(
    () => filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredRows, currentPage, pageSize],
  );
  const rangeStart = filteredRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, filteredRows.length);

  return (
    <div className="min-h-screen bg-gray-50 p-3 dark:bg-slate-950 sm:p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 sm:text-2xl">
              বকেয়া ফী
              {students.length > 0 && (
                <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[13px] font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
                  {toBanglaDigits(students.length)}
                </span>
              )}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              প্রতিটি শিক্ষার্থীর সব বকেয়া ফি এক জায়গায় — মোট বকেয়া{" "}
              <span className="font-semibold text-rose-600 dark:text-rose-400">{money(totalDue)}</span>
            </p>
          </div>
        </div>

        {/* সার্চবার — নাম, রোল, রেজিস্ট্রেশন নম্বর বা শ্রেণি দিয়ে খোঁজা যায় */}
        <div className="mb-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="নাম, রোল, রেজিস্ট্রেশন নম্বর বা শ্রেণি দিয়ে খুঁজুন..."
            className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3.5 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
          {loading ? (
            <SkeletonList items={5} />
          ) : students.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500 dark:text-slate-400">
              কোনো বকেয়া ফি নেই — সব ফি পরিশোধিত
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500 dark:text-slate-400">
              এই সার্চে কোনো ফলাফল পাওয়া যায়নি
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                {paginatedRows.map((row) => {
                  const expanded = expandedId === row.studentId;
                  return (
                    <div
                      key={row.studentId}
                      className="rounded-lg border border-gray-100 dark:border-slate-800"
                    >
                      <div className="flex flex-col gap-2 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <button
                          type="button"
                          onClick={() => setExpandedId(expanded ? null : row.studentId)}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        >
                          {expanded ? (
                            <ChevronUp className="h-4 w-4 shrink-0 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
                          )}
                          <div className="min-w-0">
                            <div className="truncate font-medium text-gray-800 dark:text-slate-200">
                              {row.studentName}
                              <span className="ml-1.5 font-normal text-gray-500 dark:text-slate-400">
                                ({row.className ? `${row.className} · ` : ""}রোল{" "}
                                {row.roll != null ? toBanglaDigits(row.roll) : "-"} · রেজি.{" "}
                                {row.registrationNo != null ? toBanglaDigits(row.registrationNo) : "-"})
                              </span>
                            </div>
                            <div className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                              {toBanglaDigits(row.invoiceCount)} টি বকেয়া ফি · প্রথম বকেয়ার তারিখ{" "}
                              {row.oldestDueDate?.slice(0, 10)}
                            </div>
                          </div>
                        </button>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="font-semibold text-rose-600 dark:text-rose-400">
                            {money(row.totalDue)}
                          </span>
                          <Link
                            to={`/fee-collection?student_id=${row.studentId}`}
                            className="h-8 rounded-md bg-blue-600 px-3 text-xs font-medium leading-8 text-white hover:bg-blue-700"
                          >
                            ফি আদায় করুন
                          </Link>
                        </div>
                      </div>

                      {expanded && (
                        <div className="border-t border-gray-100 px-3 py-2 dark:border-slate-800">
                          <div className="flex flex-col gap-1.5">
                            {row.invoices.map((inv) => (
                              <div
                                key={inv.id}
                                className="flex items-center justify-between gap-2 rounded-md bg-gray-50 px-2.5 py-1.5 text-xs dark:bg-slate-800"
                              >
                                <span className="min-w-0 truncate text-gray-600 dark:text-slate-300">
                                  {inv.title} · নির্ধারিত তারিখ {inv.dueDate?.slice(0, 10)}
                                </span>
                                <span className="shrink-0 font-medium text-rose-600 dark:text-rose-400">
                                  {money(inv.remaining)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pagination — পাতাপ্রতি কয়জন দেখাবে বেছে নেওয়া যায় */}
              <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t border-gray-100 pt-3 dark:border-slate-800 sm:flex-row">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 sm:text-sm">
                  <span>
                    দেখাচ্ছে {toBanglaDigits(rangeStart)}–{toBanglaDigits(rangeEnd)}, মোট{" "}
                    {toBanglaDigits(filteredRows.length)} জন
                  </span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="h-8 rounded-md border border-gray-300 px-2 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:text-sm"
                  >
                    {PAGE_SIZES.map((size) => (
                      <option key={size} value={size}>
                        পাতায় {toBanglaDigits(size)} জন
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="h-8 rounded-md border border-gray-300 px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 sm:text-sm"
                  >
                    আগের
                  </button>
                  <span className="text-xs text-gray-600 dark:text-slate-400 sm:text-sm">
                    পাতা {toBanglaDigits(currentPage)} / {toBanglaDigits(totalPages)}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="h-8 rounded-md border border-gray-300 px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 sm:text-sm"
                  >
                    পরের
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OverdueFeesPage;
