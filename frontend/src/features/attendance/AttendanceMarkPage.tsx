import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { cachedGet } from "../../services/api";
import { attendanceApi, type AttendanceStatus } from "../../services/phase1Api";
import { useToastStore } from "../../store/toastStore";
import { logger } from "../../utils/logger";
import { SkeletonList } from "../../components/ui/Skeleton";
import { getTenantAdminBase } from "../../utils/tenantSlug";

type Division = {
  division_id: number;
  division_name_bn: string;
};

type ClassItem = {
  class_id: number;
  class_name_bn: string;
};

type Student = {
  id: number | string;
  name_bn?: string;
  roll?: number | string;
  class_id?: number | string;
  academic_year?: string;
};

const TODAY_ISO = new Date().toISOString().slice(0, 10);

const TODAY_BN = new Date().toLocaleDateString("bn-BD", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data.filter((item) => item && typeof item === "object") : [];
};

const AttendanceMarkPage = () => {
  const { madrasaSlug = "" } = useParams();

  const [divisions, setDivisions] = useState<Division[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);

  const [selectedDivision, setSelectedDivision] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [academicYear] = useState(String(new Date().getFullYear()));

  const [classLoading, setClassLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Once today's attendance is already recorded for the selected class, the
  // sheet locks - further changes for today only happen from the Attendance
  // Report page, so a class can't accidentally get re-submitted.
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  // true = present, false = absent
  const [presentByStudent, setPresentByStudent] = useState<Record<string, boolean>>({});

  const loadDivisions = useCallback(async () => {
    try {
      const res = await cachedGet("/madrasa-divisions");
      setDivisions(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD DIVISIONS ERROR:", err);
      setDivisions([]);
    }
  }, []);

  const loadAllStudents = useCallback(async () => {
    try {
      const res = await cachedGet("/students");
      setAllStudents(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD STUDENTS ERROR:", err);
      setAllStudents([]);
    }
  }, []);

  useEffect(() => {
    loadDivisions();
    loadAllStudents();
  }, [loadDivisions, loadAllStudents]);

  const loadClassesByDivision = async (divisionId: string) => {
    setSelectedClass("");
    setPresentByStudent({});
    setAlreadySubmitted(false);

    if (!divisionId) {
      setClasses([]);
      return;
    }

    try {
      setClassLoading(true);
      const res = await cachedGet(`/madrasa-classes?division_id=${divisionId}`);
      setClasses(normalizeArray(res));
    } catch (err) {
      logger.error("CLASS LOAD ERROR:", err);
      setClasses([]);
    } finally {
      setClassLoading(false);
    }
  };

  const studentsInClass = useMemo(() => {
    if (!selectedClass) return [];
    return allStudents.filter(
      (student) =>
        String(student.class_id) === String(selectedClass) &&
        String(student.academic_year) === academicYear,
    );
  }, [allStudents, selectedClass, academicYear]);

  // Whenever the class changes, check whether today's attendance was already
  // recorded for it - if so the sheet locks (see alreadySubmitted above);
  // otherwise everyone defaults to present.
  const loadExistingAttendance = useCallback(async () => {
    if (!selectedClass || studentsInClass.length === 0) return;

    try {
      setStudentsLoading(true);
      const res = await attendanceApi.list({
        date: TODAY_ISO,
        class_id: Number(selectedClass),
        attendee_type: "STUDENT",
      });
      const existingRows = normalizeArray(res) as Array<{
        attendeeId: number;
        status: AttendanceStatus;
      }>;

      setAlreadySubmitted(existingRows.length > 0);

      const existingByStudent = new Map(
        existingRows.map((row) => [String(row.attendeeId), row]),
      );

      const next: Record<string, boolean> = {};
      for (const student of studentsInClass) {
        const existing = existingByStudent.get(String(student.id));
        next[String(student.id)] = existing ? existing.status === "PRESENT" : true;
      }
      setPresentByStudent(next);
    } catch (err) {
      logger.error("LOAD ATTENDANCE ERROR:", err);
      setAlreadySubmitted(false);
      const next: Record<string, boolean> = {};
      for (const student of studentsInClass) {
        next[String(student.id)] = true;
      }
      setPresentByStudent(next);
    } finally {
      setStudentsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass, studentsInClass.length]);

  useEffect(() => {
    loadExistingAttendance();
  }, [loadExistingAttendance]);

  const togglePresent = (studentId: number | string) => {
    if (alreadySubmitted) return;
    const key = String(studentId);
    setPresentByStudent((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const allChecked = useMemo(() => {
    const ids = studentsInClass.map((student) => String(student.id));
    return ids.length > 0 && ids.every((id) => presentByStudent[id]);
  }, [studentsInClass, presentByStudent]);

  const toggleCheckAll = () => {
    if (alreadySubmitted) return;
    const ids = studentsInClass.map((student) => String(student.id));
    const nextValue = !allChecked;
    setPresentByStudent((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = nextValue;
      return next;
    });
  };

  const presentCount = useMemo(
    () => Object.values(presentByStudent).filter(Boolean).length,
    [presentByStudent],
  );

  const handleSaveAll = async () => {
    if (!selectedClass) {
      useToastStore.getState().show("প্রথমে শ্রেণি নির্বাচন করুন", "error");
      return;
    }
    const entries = studentsInClass.map((student) => ({
      attendee_id: Number(student.id),
      status: (presentByStudent[String(student.id)] ? "PRESENT" : "ABSENT") as AttendanceStatus,
    }));
    if (entries.length === 0) {
      useToastStore.getState().show("এই শ্রেণিতে কোনো ছাত্র নেই", "error");
      return;
    }

    try {
      setSaving(true);
      await attendanceApi.bulkMark({
        attendee_type: "STUDENT",
        date: TODAY_ISO,
        class_id: Number(selectedClass),
        entries,
      });
      useToastStore.getState().show("উপস্থিতি সংরক্ষণ করা হয়েছে", "success");
      setAlreadySubmitted(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "উপস্থিতি সংরক্ষণ করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 dark:bg-slate-950 sm:p-4 md:p-6">
      <div className="mx-auto max-w-md">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 sm:text-2xl">ছাত্র উপস্থিতি</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            আজকের তারিখ: <span className="font-medium">{TODAY_BN}</span> · টিক দিলে উপস্থিত, টিক না দিলে অনুপস্থিত
          </p>
        </div>

        {/* Filters */}
        <div className="mb-4 rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <select
              value={selectedDivision}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedDivision(value);
                loadClassesByDivision(value);
              }}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[160px]"
            >
              <option value="">বিভাগ নির্বাচন করুন</option>
              {divisions.map((division) => (
                <option key={division.division_id} value={division.division_id}>
                  {division.division_name_bn}
                </option>
              ))}
            </select>

            <select
              value={selectedClass}
              onChange={(event) => setSelectedClass(event.target.value)}
              disabled={!selectedDivision || classLoading}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500 sm:w-[180px]"
            >
              <option value="">
                {classLoading ? "শ্রেণি লোড হচ্ছে..." : "শ্রেণি নির্বাচন করুন"}
              </option>
              {classes.map((classItem) => (
                <option key={classItem.class_id} value={classItem.class_id}>
                  {classItem.class_name_bn}
                </option>
              ))}
            </select>
          </div>

          {selectedClass && (
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-600 dark:text-slate-400">
              <span>মোট: {studentsInClass.length}</span>
              <span className="text-green-700 dark:text-green-400">উপস্থিত: {presentCount}</span>
              <span className="text-red-700 dark:text-red-400">
                অনুপস্থিত: {studentsInClass.length - presentCount}
              </span>
            </div>
          )}
        </div>

        {/* Already-submitted notice */}
        {selectedClass && alreadySubmitted && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            <span>আজকের উপস্থিতি ইতিমধ্যে জমা দেওয়া হয়েছে। পরিবর্তনের প্রয়োজন হলে উপস্থিতি রিপোর্ট থেকে এডিট করুন।</span>
            <Link
              to={`${getTenantAdminBase(madrasaSlug)}/attendance/report`}
              className="shrink-0 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 transition hover:bg-amber-100 dark:border-amber-800 dark:bg-transparent dark:text-amber-300 dark:hover:bg-amber-950/50"
            >
              উপস্থিতি রিপোর্টে যান
            </Link>
          </div>
        )}

        {/* Student list */}
        {!selectedClass ? (
          <div className="rounded-xl bg-white p-10 text-center text-sm text-gray-500 shadow-sm dark:bg-slate-900 dark:text-slate-400">
            উপস্থিতি নেওয়ার জন্য প্রথমে বিভাগ ও শ্রেণি নির্বাচন করুন
          </div>
        ) : studentsLoading ? (
          <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
            <SkeletonList items={6} />
          </div>
        ) : studentsInClass.length === 0 ? (
          <div className="rounded-xl bg-white p-10 text-center text-sm text-gray-500 shadow-sm dark:bg-slate-900 dark:text-slate-400">
            এই শ্রেণিতে {academicYear} শিক্ষাবর্ষে কোনো ছাত্র নেই
          </div>
        ) : (
          <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
            <label
              className={`flex items-center justify-between gap-3 border-b border-gray-200 pb-2 text-sm font-medium text-gray-700 dark:border-slate-700 dark:text-slate-200 ${
                alreadySubmitted ? "opacity-60" : "cursor-pointer"
              }`}
            >
              <span>সবাইকে উপস্থিত করুন</span>
              <input
                type="checkbox"
                checked={allChecked}
                onChange={toggleCheckAll}
                disabled={alreadySubmitted}
                className="h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed dark:border-slate-600"
              />
            </label>

            <div className="divide-y divide-gray-100 dark:divide-slate-800">
              {studentsInClass
                .slice()
                .sort((a, b) => Number(a.roll || 0) - Number(b.roll || 0))
                .map((student) => {
                  const isPresent = presentByStudent[String(student.id)] ?? true;

                  return (
                    <label
                      key={student.id}
                      className={`flex items-center justify-between gap-3 py-2.5 ${
                        alreadySubmitted ? "" : "cursor-pointer"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="w-10 shrink-0 text-sm font-semibold text-gray-500 dark:text-slate-400">
                          {student.roll ?? "-"}
                        </span>
                        <span
                          className={`truncate text-sm ${
                            isPresent
                              ? "text-gray-800 dark:text-slate-200"
                              : "text-gray-400 line-through dark:text-slate-500"
                          }`}
                        >
                          {student.name_bn || "নাম নেই"}
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={isPresent}
                        onChange={() => togglePresent(student.id)}
                        disabled={alreadySubmitted}
                        className="h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed dark:border-slate-600"
                      />
                    </label>
                  );
                })}
            </div>

            {!alreadySubmitted && (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveAll}
                  className="h-10 w-full rounded-lg bg-blue-600 px-6 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
                >
                  {saving ? "সংরক্ষণ হচ্ছে..." : "উপস্থিতি সংরক্ষণ করুন"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceMarkPage;
