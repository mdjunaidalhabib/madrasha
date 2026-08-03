import { useCallback, useEffect, useMemo, useState } from "react";
import { cachedGet } from "../../services/api";
import { promotionApi, type PromotionPreviewRow } from "../../services/phase1Api";
import { useToastStore } from "../../store/toastStore";
import Modal from "../../components/ui/Modal";
import { logger } from "../../utils/logger";
import { SkeletonList } from "../../components/ui/Skeleton";

type Division = {
  division_id: number;
  division_name_bn: string;
};

type ClassItem = {
  class_id: number;
  class_name_bn: string;
};

type Exam = {
  id: number;
  name: string;
  year: string | number;
};

type DecisionStatus = "PROMOTED" | "RETAINED" | "TRANSFERRED";

const ACADEMIC_YEARS = ["2022", "2023", "2024", "2025", "2026", "2027"];

const STATUS_LABELS: Record<DecisionStatus, string> = {
  PROMOTED: "উত্তীর্ণ (পরের শ্রেণিতে)",
  RETAINED: "অকৃতকার্য (একই শ্রেণিতে থাকবে)",
  TRANSFERRED: "স্থানান্তরিত",
};

const RESULT_LABELS: Record<string, string> = {
  PASS: "পাস",
  FAIL: "ফেল",
  ABSENT: "অনুপস্থিত",
  NO_RESULT: "ফলাফল নেই",
};

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

const currentYear = String(new Date().getFullYear());
const nextYear = String(new Date().getFullYear() + 1);

const StudentPromotionPage = () => {
  const [divisions, setDivisions] = useState<Division[]>([]);

  // FROM side
  const [fromDivision, setFromDivision] = useState("");
  const [fromClasses, setFromClasses] = useState<ClassItem[]>([]);
  const [fromClass, setFromClass] = useState("");
  const [fromYear, setFromYear] = useState(currentYear);
  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState("");

  // TO side
  const [toDivision, setToDivision] = useState("");
  const [toClasses, setToClasses] = useState<ClassItem[]>([]);
  const [toClass, setToClass] = useState("");
  const [toYear, setToYear] = useState(nextYear);

  const [fromClassLoading, setFromClassLoading] = useState(false);
  const [toClassLoading, setToClassLoading] = useState(false);

  const [previewLoading, setPreviewLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [rows, setRows] = useState<(PromotionPreviewRow & { status: DecisionStatus })[]>([]);
  const [previewed, setPreviewed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const loadDivisions = useCallback(async () => {
    try {
      const res = await cachedGet("/madrasa-divisions");
      setDivisions(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD DIVISIONS ERROR:", err);
      setDivisions([]);
    }
  }, []);

  const loadExams = useCallback(async () => {
    try {
      const res = await cachedGet("/exams");
      setExams(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD EXAMS ERROR:", err);
      setExams([]);
    }
  }, []);

  useEffect(() => {
    loadDivisions();
    loadExams();
  }, [loadDivisions, loadExams]);

  const loadClasses = async (
    divisionId: string,
    setClasses: (v: ClassItem[]) => void,
    setLoading: (v: boolean) => void,
  ) => {
    if (!divisionId) {
      setClasses([]);
      return;
    }
    try {
      setLoading(true);
      const res = await cachedGet(`/madrasa-classes?division_id=${divisionId}`);
      setClasses(normalizeArray(res));
    } catch (err) {
      logger.error("CLASS LOAD ERROR:", err);
      setClasses([]);
    } finally {
      setLoading(false);
    }
  };

  const canPreview = fromClass && fromYear;
  const canExecute = toClass && toYear && rows.length > 0;

  const handlePreview = async () => {
    if (!canPreview) {
      useToastStore.getState().show("আগে শ্রেণি ও শিক্ষাবর্ষ নির্বাচন করুন", "error");
      return;
    }

    try {
      setPreviewLoading(true);
      setPreviewed(false);
      const res = await promotionApi.preview({
        from_class_id: Number(fromClass),
        from_year: fromYear,
        exam_id: examId ? Number(examId) : undefined,
      });
      const data = res.data?.data || [];
      setRows(
        data.map((row) => ({
          ...row,
          status: row.suggested_status as DecisionStatus,
        })),
      );
      setPreviewed(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "প্রিভিউ লোড করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setPreviewLoading(false);
    }
  };

  const setRowStatus = (studentId: number, status: DecisionStatus) => {
    setRows((prev) =>
      prev.map((row) => (row.student_id === studentId ? { ...row, status } : row)),
    );
  };

  const summary = useMemo(() => {
    const counts = { PROMOTED: 0, RETAINED: 0, TRANSFERRED: 0 };
    for (const row of rows) counts[row.status] += 1;
    return counts;
  }, [rows]);

  const handleExecute = async () => {
    if (!canExecute) return;

    try {
      setExecuting(true);
      const res = await promotionApi.execute({
        from_class_id: Number(fromClass),
        to_class_id: Number(toClass),
        from_year: fromYear,
        to_year: toYear,
        decisions: rows.map((row) => ({ student_id: row.student_id, status: row.status })),
      });
      const data = (res.data as any)?.data;
      useToastStore
        .getState()
        .show(
          `প্রমোশন সম্পন্ন হয়েছে — উত্তীর্ণ: ${data?.promoted ?? summary.PROMOTED}, অকৃতকার্য: ${
            data?.retained ?? summary.RETAINED
          }, স্থানান্তরিত: ${data?.transferred ?? summary.TRANSFERRED}`,
          "success",
        );
      setRows([]);
      setPreviewed(false);
      setConfirmOpen(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "প্রমোশন সম্পন্ন করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">শিক্ষার্থী প্রমোশন</h1>
          <p className="mt-1 text-sm text-gray-500">
            এক শ্রেণি থেকে পরের শ্রেণিতে/শিক্ষাবর্ষে একসাথে সবাইকে প্রমোট করুন
          </p>
        </div>

        {/* FROM section */}
        <div className="mb-4 rounded-xl bg-white p-3 shadow-sm sm:p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">১. বর্তমান শ্রেণি</h2>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <select
              value={fromDivision}
              onChange={(event) => {
                const value = event.target.value;
                setFromDivision(value);
                setFromClass("");
                loadClasses(value, setFromClasses, setFromClassLoading);
              }}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 sm:w-[160px]"
            >
              <option value="">বিভাগ নির্বাচন করুন</option>
              {divisions.map((division) => (
                <option key={division.division_id} value={division.division_id}>
                  {division.division_name_bn}
                </option>
              ))}
            </select>

            <select
              value={fromClass}
              onChange={(event) => setFromClass(event.target.value)}
              disabled={!fromDivision || fromClassLoading}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-400 sm:w-[180px]"
            >
              <option value="">
                {fromClassLoading ? "লোড হচ্ছে..." : "শ্রেণি নির্বাচন করুন"}
              </option>
              {fromClasses.map((classItem) => (
                <option key={classItem.class_id} value={classItem.class_id}>
                  {classItem.class_name_bn}
                </option>
              ))}
            </select>

            <select
              value={fromYear}
              onChange={(event) => setFromYear(event.target.value)}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 sm:w-[130px]"
            >
              {ACADEMIC_YEARS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>

            <select
              value={examId}
              onChange={(event) => setExamId(event.target.value)}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 sm:w-[200px]"
            >
              <option value="">ফলাফল যাচাই (ঐচ্ছিক - সর্বশেষ পরীক্ষা)</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.name} — {exam.year}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={!canPreview || previewLoading}
              onClick={handlePreview}
              className="h-9 w-full rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
            >
              {previewLoading ? "প্রিভিউ লোড হচ্ছে..." : "প্রিভিউ দেখুন"}
            </button>
          </div>
        </div>

        {/* Preview + decisions */}
        {(previewLoading || previewed) && (
          <div className="mb-4 rounded-xl bg-white p-3 shadow-sm sm:p-4">
            {previewLoading ? (
              <SkeletonList items={6} />
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-gray-700">
                    ২. প্রতিটি ছাত্রের সিদ্ধান্ত পর্যালোচনা করুন
                  </h2>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                    <span>মোট: {rows.length}</span>
                    <span className="text-green-700">উত্তীর্ণ: {summary.PROMOTED}</span>
                    <span className="text-red-700">অকৃতকার্য: {summary.RETAINED}</span>
                    <span className="text-gray-700">স্থানান্তরিত: {summary.TRANSFERRED}</span>
                  </div>
                </div>

                {rows.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-500">
                    এই শ্রেণি ও শিক্ষাবর্ষে কোনো সক্রিয় ছাত্র পাওয়া যায়নি
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {rows.map((row) => (
                      <div
                        key={row.student_id}
                        className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-10 shrink-0 text-sm font-semibold text-gray-500">
                            {row.roll ?? "-"}
                          </span>
                          <span className="text-sm font-medium text-gray-800">{row.name_bn}</span>
                          <span
                            className={`rounded px-2 py-0.5 text-xs ${
                              row.result_status === "FAIL"
                                ? "bg-red-100 text-red-700"
                                : row.result_status === "PASS"
                                  ? "bg-green-100 text-green-700"
                                  : row.result_status === "ABSENT"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {RESULT_LABELS[row.result_status] || row.result_status}
                          </span>
                        </div>

                        <select
                          value={row.status}
                          onChange={(event) =>
                            setRowStatus(row.student_id, event.target.value as DecisionStatus)
                          }
                          className="h-8 w-full rounded-md border border-gray-300 px-2 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 sm:w-[220px]"
                        >
                          {(Object.keys(STATUS_LABELS) as DecisionStatus[]).map((status) => (
                            <option key={status} value={status}>
                              {STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* TO section + execute */}
        {previewed && rows.length > 0 && (
          <div className="rounded-xl bg-white p-3 shadow-sm sm:p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">
              ৩. যে শ্রেণি/শিক্ষাবর্ষে প্রমোট হবে
            </h2>
            <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <select
                value={toDivision}
                onChange={(event) => {
                  const value = event.target.value;
                  setToDivision(value);
                  setToClass("");
                  loadClasses(value, setToClasses, setToClassLoading);
                }}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 sm:w-[160px]"
              >
                <option value="">বিভাগ নির্বাচন করুন</option>
                {divisions.map((division) => (
                  <option key={division.division_id} value={division.division_id}>
                    {division.division_name_bn}
                  </option>
                ))}
              </select>

              <select
                value={toClass}
                onChange={(event) => setToClass(event.target.value)}
                disabled={!toDivision || toClassLoading}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-400 sm:w-[180px]"
              >
                <option value="">
                  {toClassLoading ? "লোড হচ্ছে..." : "শ্রেণি নির্বাচন করুন"}
                </option>
                {toClasses.map((classItem) => (
                  <option key={classItem.class_id} value={classItem.class_id}>
                    {classItem.class_name_bn}
                  </option>
                ))}
              </select>

              <select
                value={toYear}
                onChange={(event) => setToYear(event.target.value)}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 sm:w-[130px]"
              >
                {ACADEMIC_YEARS.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={!canExecute}
                onClick={() => setConfirmOpen(true)}
                className="h-9 w-full rounded-md bg-green-600 px-4 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-60 sm:w-auto"
              >
                প্রমোশন সম্পন্ন করুন
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal open={confirmOpen} title="প্রমোশন নিশ্চিত করুন" onClose={() => setConfirmOpen(false)}>
        <p className="text-sm text-gray-700">
          মোট <strong>{rows.length}</strong> জন ছাত্রের মধ্যে{" "}
          <strong className="text-green-700">{summary.PROMOTED}</strong> জন উত্তীর্ণ,{" "}
          <strong className="text-red-700">{summary.RETAINED}</strong> জন অকৃতকার্য এবং{" "}
          <strong>{summary.TRANSFERRED}</strong> জন স্থানান্তরিত হিসেবে চিহ্নিত হবে। এই কাজটি
          পরে সহজে undo করা যাবে না। নিশ্চিত?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirmOpen(false)}
            className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            বাতিল
          </button>
          <button
            type="button"
            disabled={executing}
            onClick={handleExecute}
            className="h-9 rounded-md bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
          >
            {executing ? "সম্পন্ন হচ্ছে..." : "হ্যাঁ, নিশ্চিত করুন"}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default StudentPromotionPage;
