import { useCallback, useEffect, useState } from "react";
import { cachedGet } from "../../services/api";
import { examRoutineApi } from "../../services/phase1Api";
import {
  examAttendanceApi,
  ExamAttendanceRow,
  ExamAttendanceStatus,
  EXAM_ATTENDANCE_STATUS_VALUES,
  EXAM_ATTENDANCE_STATUS_LABELS_BN,
} from "../../services/examOperationsApi";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { SkeletonList } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { divisionsForExam, examsForDivision, useClearMismatchedExam } from "../../components/ExamPanel/examDivisionScope";

type Division = { division_id: number; division_name_bn: string };
type ClassItem = { class_id: number; class_name_bn: string };
type Exam = { id: number; name: string; year: string | number; division_ids?: number[] };
type ExamRoutineRow = {
  id: number;
  subject: string;
  examDate: string;
  startTime: string;
  endTime: string;
};

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

const STATUS_COLORS: Record<ExamAttendanceStatus, string> = {
  PRESENT: "bg-green-600",
  ABSENT: "bg-red-600",
  LATE: "bg-amber-500",
  EXCUSED: "bg-blue-500",
  WITHHELD: "bg-gray-500",
};

const ExamAttendancePage = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [division, setDivision] = useState("");
  const [classId, setClassId] = useState("");
  const [examId, setExamId] = useState("");

  const [routines, setRoutines] = useState<ExamRoutineRow[]>([]);
  const [routineId, setRoutineId] = useState("");

  const [search, setSearch] = useState("");
  const [roster, setRoster] = useState<ExamAttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<number, ExamAttendanceStatus>>({});

  // বিভাগভিত্তিক পরীক্ষা: drop the exam if the picked division isn't one it's held for.
  useClearMismatchedExam(exams, examId, division, () => setExamId(""));

  useEffect(() => {
    (async () => {
      try {
        const [examRes, divisionRes] = await Promise.all([
          cachedGet("/exams", { params: { active_only: true } }),
          cachedGet("/madrasa-divisions"),
        ]);
        setExams(normalizeArray(examRes));
        setDivisions(normalizeArray(divisionRes));
      } catch (err) {
        logger.error("EXAM ATTENDANCE INIT LOAD ERROR:", err);
      }
    })();
  }, []);

  const loadClasses = async (divisionId: string) => {
    setClassId("");
    if (!divisionId) {
      setClasses([]);
      return;
    }
    try {
      const res = await cachedGet(`/madrasa-classes?division_id=${divisionId}`);
      setClasses(normalizeArray(res));
    } catch (err) {
      logger.error("EXAM ATTENDANCE CLASS LOAD ERROR:", err);
      setClasses([]);
    }
  };

  const loadRoutines = useCallback(async () => {
    if (!examId || !classId) {
      setRoutines([]);
      return;
    }
    try {
      const res = await examRoutineApi.list({ exam_id: Number(examId), class_id: Number(classId) });
      setRoutines(normalizeArray(res));
    } catch (err) {
      logger.error("EXAM ATTENDANCE ROUTINE LOAD ERROR:", err);
      setRoutines([]);
    }
  }, [examId, classId]);

  useEffect(() => {
    loadRoutines();
    setRoutineId("");
  }, [loadRoutines]);

  const loadRoster = useCallback(async () => {
    if (!routineId) {
      setRoster([]);
      return;
    }
    try {
      setLoading(true);
      const res = await examAttendanceApi.listByRoutine(Number(routineId), { search: search.trim() || undefined });
      setRoster(normalizeArray(res));
      setPendingChanges({});
    } catch (err) {
      logger.error("EXAM ATTENDANCE ROSTER LOAD ERROR:", err);
      setRoster([]);
    } finally {
      setLoading(false);
    }
  }, [routineId, search]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  const isLocked = roster.some((r) => r.is_locked);

  const setStatus = (examCandidateId: number, status: ExamAttendanceStatus) => {
    if (isLocked) return;
    setPendingChanges((prev) => ({ ...prev, [examCandidateId]: status }));
  };

  const statusFor = (row: ExamAttendanceRow): ExamAttendanceStatus =>
    pendingChanges[row.exam_candidate_id] ?? row.status;

  const handleSave = async () => {
    if (!routineId || !Object.keys(pendingChanges).length) {
      useToastStore.getState().show("কোনো পরিবর্তন নেই", "error");
      return;
    }
    try {
      setSaving(true);
      await examAttendanceApi.bulkMark({
        exam_routine_id: Number(routineId),
        entries: Object.entries(pendingChanges).map(([examCandidateId, status]) => ({
          exam_candidate_id: Number(examCandidateId),
          status,
        })),
      });
      useToastStore.getState().show("হাজিরা সংরক্ষণ করা হয়েছে", "success");
      loadRoster();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "সংরক্ষণ করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAllPresent = async () => {
    if (!routineId) return;
    try {
      setSaving(true);
      await examAttendanceApi.bulkMark({
        exam_routine_id: Number(routineId),
        entries: roster.map((r) => ({ exam_candidate_id: r.exam_candidate_id, status: "PRESENT" })),
        mark_absent_by_default: true,
      });
      useToastStore.getState().show("সবাইকে উপস্থিত হিসেবে চিহ্নিত করা হয়েছে", "success");
      loadRoster();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "সংরক্ষণ করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleLockToggle = async () => {
    if (!routineId) return;
    const confirmMsg = isLocked
      ? "হাজিরা আনলক করতে চান? এরপর আবার সম্পাদনা করা যাবে।"
      : "হাজিরা লক করতে চান? লক করার পর আর সম্পাদনা করা যাবে না, শুধু আনলক করলে হবে।";
    if (!window.confirm(confirmMsg)) return;
    try {
      if (isLocked) await examAttendanceApi.unlock(Number(routineId));
      else await examAttendanceApi.lock(Number(routineId));
      useToastStore.getState().show(isLocked ? "আনলক করা হয়েছে" : "লক করা হয়েছে", "success");
      loadRoster();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 dark:bg-slate-950 sm:p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 sm:text-2xl">পরীক্ষার হাজিরা</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">প্রতিটি পরীক্ষার সিটিং-এর জন্য পৃথক হাজিরা নিন</p>
        </div>

        <div className="mb-4 rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <select
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[180px]"
            >
              <option value="">পরীক্ষা নির্বাচন করুন</option>
              {examsForDivision(exams, division).map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.name} — {exam.year}
                </option>
              ))}
            </select>
            <select
              value={division}
              onChange={(e) => {
                setDivision(e.target.value);
                loadClasses(e.target.value);
              }}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[160px]"
            >
              <option value="">বিভাগ নির্বাচন করুন</option>
              {divisionsForExam(
                divisions,
                exams.find((e) => String(e.id) === examId),
              ).map((d) => (
                <option key={d.division_id} value={d.division_id}>
                  {d.division_name_bn}
                </option>
              ))}
            </select>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              disabled={!division}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none disabled:bg-gray-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[160px]"
            >
              <option value="">শ্রেণি নির্বাচন করুন</option>
              {classes.map((c) => (
                <option key={c.class_id} value={c.class_id}>
                  {c.class_name_bn}
                </option>
              ))}
            </select>
            <select
              value={routineId}
              onChange={(e) => setRoutineId(e.target.value)}
              disabled={!routines.length}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none disabled:bg-gray-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[220px]"
            >
              <option value="">সময়সূচি (বিষয়/তারিখ) নির্বাচন করুন</option>
              {routines.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.subject} — {String(r.examDate).slice(0, 10)} ({r.startTime}-{r.endTime})
                </option>
              ))}
            </select>
            {routineId && (
              <input
                type="text"
                placeholder="নাম/রোল দিয়ে খুঁজুন"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[180px]"
              />
            )}
          </div>
        </div>

        {routineId && (
          <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">
                শিক্ষার্থী তালিকা {isLocked && <span className="ml-2 text-xs text-red-600 dark:text-red-400">(লকড)</span>}
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isLocked || saving}
                  onClick={handleMarkAllPresent}
                  className="h-8 rounded-md border border-green-300 bg-green-50 px-3 text-xs font-medium text-green-700 disabled:opacity-50 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-400"
                >
                  সবাইকে উপস্থিত করুন
                </button>
                <button
                  type="button"
                  disabled={!Object.keys(pendingChanges).length || saving}
                  onClick={handleSave}
                  className="h-8 rounded-md bg-blue-600 px-3 text-xs font-medium text-white disabled:opacity-50"
                >
                  সংরক্ষণ করুন
                </button>
                <button
                  type="button"
                  onClick={handleLockToggle}
                  className="h-8 rounded-md border border-gray-300 px-3 text-xs font-medium text-gray-600 dark:border-slate-700 dark:text-slate-300"
                >
                  {isLocked ? "আনলক করুন" : "লক করুন"}
                </button>
              </div>
            </div>

            {loading ? (
              <SkeletonList items={8} />
            ) : roster.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-500 dark:text-slate-400">এই সময়সূচির জন্য কোনো নিবন্ধিত পরীক্ষার্থী নেই</div>
            ) : (
              <div className="flex flex-col gap-2">
                {roster.map((row) => (
                  <div
                    key={row.exam_candidate_id}
                    className="flex flex-col gap-1 rounded-lg border border-gray-200 p-2 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700"
                  >
                    <div className="text-sm">
                      <span className="font-medium text-gray-800 dark:text-slate-200">{row.student_name_bn}</span>
                      {row.roll != null && <span className="text-gray-500 dark:text-slate-400"> · রোল {row.roll}</span>}
                      {row.candidate_no && <span className="text-gray-500 dark:text-slate-400"> · আসন {row.candidate_no}</span>}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {EXAM_ATTENDANCE_STATUS_VALUES.map((status) => (
                        <button
                          key={status}
                          type="button"
                          disabled={isLocked}
                          onClick={() => setStatus(row.exam_candidate_id, status)}
                          className={`h-7 rounded-md px-2 text-xs font-medium text-white transition disabled:opacity-40 ${
                            statusFor(row) === status ? STATUS_COLORS[status] : "bg-gray-300 dark:bg-slate-700"
                          }`}
                        >
                          {EXAM_ATTENDANCE_STATUS_LABELS_BN[status]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamAttendancePage;
