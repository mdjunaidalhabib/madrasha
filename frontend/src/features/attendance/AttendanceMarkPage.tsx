import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { cachedGet } from "../../services/api";
import { attendanceApi, type AttendanceStatus } from "../../services/phase1Api";
import { useToastStore } from "../../store/toastStore";
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

type Student = {
  id: number | string;
  name_bn?: string;
  roll?: number | string;
  class_id?: number | string;
  academic_year?: string;
};

type AttendanceRow = {
  attendee_id: number;
  status: AttendanceStatus;
  remarks: string;
};

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; activeClass: string }[] = [
  { value: "PRESENT", label: "উপস্থিত", activeClass: "bg-green-600 text-white" },
  { value: "ABSENT", label: "অনুপস্থিত", activeClass: "bg-red-600 text-white" },
  { value: "LATE", label: "দেরি", activeClass: "bg-amber-500 text-white" },
  { value: "LEAVE", label: "ছুটি", activeClass: "bg-blue-500 text-white" },
];

const todayIso = () => new Date().toISOString().slice(0, 10);

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

const AttendanceMarkPage = () => {
  const { madrasaSlug: _madrasaSlug = "" } = useParams();

  const [divisions, setDivisions] = useState<Division[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);

  const [selectedDivision, setSelectedDivision] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [academicYear] = useState(String(new Date().getFullYear()));

  const [classLoading, setClassLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [attendanceByStudent, setAttendanceByStudent] = useState<
    Record<string, AttendanceRow>
  >({});

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
    setAttendanceByStudent({});

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

  // Whenever class or date changes, load any already-saved attendance for
  // that day and prefill; anyone not yet marked defaults to PRESENT.
  const loadExistingAttendance = useCallback(async () => {
    if (!selectedClass || !selectedDate || studentsInClass.length === 0) return;

    try {
      setStudentsLoading(true);
      const res = await attendanceApi.list({
        date: selectedDate,
        class_id: Number(selectedClass),
        attendee_type: "STUDENT",
      });
      const existingRows = normalizeArray(res) as Array<{
        attendeeId: number;
        status: AttendanceStatus;
        remarks?: string | null;
      }>;

      const existingByStudent = new Map(
        existingRows.map((row) => [String(row.attendeeId), row]),
      );

      const next: Record<string, AttendanceRow> = {};
      for (const student of studentsInClass) {
        const existing = existingByStudent.get(String(student.id));
        next[String(student.id)] = {
          attendee_id: Number(student.id),
          status: existing?.status || "PRESENT",
          remarks: existing?.remarks || "",
        };
      }
      setAttendanceByStudent(next);
    } catch (err) {
      logger.error("LOAD ATTENDANCE ERROR:", err);
      // fall back to a fresh "all present" sheet rather than blocking the page
      const next: Record<string, AttendanceRow> = {};
      for (const student of studentsInClass) {
        next[String(student.id)] = {
          attendee_id: Number(student.id),
          status: "PRESENT",
          remarks: "",
        };
      }
      setAttendanceByStudent(next);
    } finally {
      setStudentsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass, selectedDate, studentsInClass.length]);

  useEffect(() => {
    loadExistingAttendance();
  }, [loadExistingAttendance]);

  const setStatus = (studentId: number | string, status: AttendanceStatus) => {
    setAttendanceByStudent((prev) => ({
      ...prev,
      [String(studentId)]: { ...prev[String(studentId)], status },
    }));
  };

  const setRemarks = (studentId: number | string, remarks: string) => {
    setAttendanceByStudent((prev) => ({
      ...prev,
      [String(studentId)]: { ...prev[String(studentId)], remarks },
    }));
  };

  const markAllPresent = () => {
    setAttendanceByStudent((prev) => {
      const next: Record<string, AttendanceRow> = {};
      for (const key of Object.keys(prev)) {
        next[key] = { ...prev[key], status: "PRESENT" };
      }
      return next;
    });
  };

  const summary = useMemo(() => {
    const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0 };
    for (const row of Object.values(attendanceByStudent)) {
      counts[row.status] += 1;
    }
    return counts;
  }, [attendanceByStudent]);

  const handleSaveAll = async () => {
    if (!selectedClass) {
      useToastStore.getState().show("প্রথমে শ্রেণি নির্বাচন করুন", "error");
      return;
    }
    const entries = Object.values(attendanceByStudent).map((row) => ({
      attendee_id: row.attendee_id,
      status: row.status,
      remarks: row.remarks?.trim() || undefined,
    }));
    if (entries.length === 0) {
      useToastStore.getState().show("এই শ্রেণিতে কোনো ছাত্র নেই", "error");
      return;
    }

    try {
      setSaving(true);
      await attendanceApi.bulkMark({
        attendee_type: "STUDENT",
        date: selectedDate,
        class_id: Number(selectedClass),
        entries,
      });
      useToastStore.getState().show("উপস্থিতি সংরক্ষণ করা হয়েছে", "success");
    } catch (err: any) {
      const msg = err?.response?.data?.message || "উপস্থিতি সংরক্ষণ করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">ছাত্র উপস্থিতি</h1>
          <p className="mt-1 text-sm text-gray-500">
            শ্রেণি ও তারিখ নির্বাচন করে একসাথে সবার উপস্থিতি সংরক্ষণ করুন
          </p>
        </div>

        {/* Filters */}
        <div className="mb-4 rounded-xl bg-white p-3 shadow-sm sm:p-4">
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-100 sm:w-[160px]"
            />

            <select
              value={selectedDivision}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedDivision(value);
                loadClassesByDivision(value);
              }}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-100 sm:w-[160px]"
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
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-400 sm:w-[180px]"
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

            {selectedClass && (
              <button
                type="button"
                onClick={markAllPresent}
                className="h-9 w-full rounded-md border border-green-300 bg-green-50 px-3 text-sm font-medium text-green-700 transition hover:bg-green-100 sm:w-auto"
              >
                সবাইকে উপস্থিত করুন
              </button>
            )}
          </div>

          {selectedClass && (
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-600">
              <span>মোট: {studentsInClass.length}</span>
              <span className="text-green-700">উপস্থিত: {summary.PRESENT}</span>
              <span className="text-red-700">অনুপস্থিত: {summary.ABSENT}</span>
              <span className="text-amber-700">দেরি: {summary.LATE}</span>
              <span className="text-blue-700">ছুটি: {summary.LEAVE}</span>
            </div>
          )}
        </div>

        {/* Student list */}
        {!selectedClass ? (
          <div className="rounded-xl bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
            উপস্থিতি নেওয়ার জন্য প্রথমে বিভাগ ও শ্রেণি নির্বাচন করুন
          </div>
        ) : studentsLoading ? (
          <div className="rounded-xl bg-white p-3 shadow-sm sm:p-4">
            <SkeletonList items={6} />
          </div>
        ) : studentsInClass.length === 0 ? (
          <div className="rounded-xl bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
            এই শ্রেণিতে {academicYear} শিক্ষাবর্ষে কোনো ছাত্র নেই
          </div>
        ) : (
          <div className="rounded-xl bg-white p-3 shadow-sm sm:p-4">
            <div className="flex flex-col gap-2">
              {studentsInClass
                .slice()
                .sort((a, b) => Number(a.roll || 0) - Number(b.roll || 0))
                .map((student) => {
                  const row = attendanceByStudent[String(student.id)];
                  if (!row) return null;

                  return (
                    <div
                      key={student.id}
                      className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-10 shrink-0 text-sm font-semibold text-gray-500">
                          {student.roll ?? "-"}
                        </span>
                        <span className="text-sm font-medium text-gray-800">
                          {student.name_bn || "নাম নেই"}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex overflow-hidden rounded-md border border-gray-300">
                          {STATUS_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setStatus(student.id, option.value)}
                              className={`h-8 px-3 text-xs font-medium transition ${
                                row.status === option.value
                                  ? option.activeClass
                                  : "bg-white text-gray-600 hover:bg-gray-50"
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>

                        <input
                          type="text"
                          value={row.remarks}
                          onChange={(event) => setRemarks(student.id, event.target.value)}
                          placeholder="মন্তব্য (ঐচ্ছিক)"
                          className="h-8 w-full max-w-[160px] rounded-md border border-gray-300 px-2 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                        />
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveAll}
                className="h-10 w-full rounded-lg bg-blue-600 px-6 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
              >
                {saving ? "সংরক্ষণ হচ্ছে..." : "সব সংরক্ষণ করুন"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceMarkPage;
