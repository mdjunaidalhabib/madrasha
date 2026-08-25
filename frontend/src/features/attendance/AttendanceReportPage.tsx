import { useCallback, useEffect, useMemo, useState } from "react";
import { cachedGet } from "../../services/api";
import { attendanceApi, type AttendanceStatus } from "../../services/phase1Api";
import { useToastStore } from "../../store/toastStore";
import { logger } from "../../utils/logger";
import PageHeader from "../../components/ui/PageHeader";
import StatTile from "../../components/ui/StatTile";
import { SkeletonList } from "../../components/ui/Skeleton";

type Division = { division_id: number; division_name_bn: string };
type ClassItem = { class_id: number; class_name_bn: string; division_id?: number };
type Student = {
  id: number | string;
  name_bn?: string;
  roll?: number | string;
  class_id?: number | string;
  academic_year?: string;
};
type AttendanceRecord = {
  attendeeId: number;
  date: string;
  status: AttendanceStatus;
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7);

const monthRange = (month: string) => {
  const [year, monthNum] = month.split("-").map(Number);
  const from = `${month}-01`;
  const lastDay = new Date(year, monthNum, 0).getDate();
  const to = `${month}-${String(lastDay).padStart(2, "0")}`;
  return { from, to: to > todayIso() ? todayIso() : to };
};

const formatBnDate = (iso: string) => {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("bn-BD", { year: "numeric", month: "long", day: "numeric" });
};

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data.filter((item) => item && typeof item === "object") : [];
};

const AttendanceReportPage = () => {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [allClasses, setAllClasses] = useState<ClassItem[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);

  const [selectedDivision, setSelectedDivision] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [academicYear] = useState(String(new Date().getFullYear()));

  const [classLoading, setClassLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  const [editDate, setEditDate] = useState("");
  const [editPresentByStudent, setEditPresentByStudent] = useState<Record<string, boolean>>({});
  const [editSaving, setEditSaving] = useState(false);

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

  // For the class-wise dashboard (no class selected yet) we need every
  // class's name across every division - /madrasa-classes only answers for
  // one division_id at a time, so fetch each division's classes in parallel
  // once the division list is in.
  useEffect(() => {
    if (divisions.length === 0) return;
    (async () => {
      try {
        const results = await Promise.all(
          divisions.map((division) =>
            cachedGet(`/madrasa-classes?division_id=${division.division_id}`).then(normalizeArray),
          ),
        );
        setAllClasses(results.flat());
      } catch (err) {
        logger.error("LOAD ALL CLASSES ERROR:", err);
        setAllClasses([]);
      }
    })();
  }, [divisions]);

  const loadClassesByDivision = async (divisionId: string) => {
    setSelectedClass("");
    setRecords([]);
    setEditDate("");

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

  // Drill down from the class-wise dashboard row straight into that class's
  // day-wise detail (and edit capability), without making the admin re-pick
  // the division/class from the filter dropdowns.
  const openClassDetail = async (classItem: ClassItem) => {
    const divisionId = String(classItem.division_id ?? "");
    setSelectedDivision(divisionId);
    if (divisionId) await loadClassesByDivision(divisionId);
    setSelectedClass(String(classItem.class_id));
  };

  const studentsInClass = useMemo(() => {
    if (!selectedClass) return [];
    return allStudents.filter(
      (student) =>
        String(student.class_id) === String(selectedClass) &&
        String(student.academic_year) === academicYear,
    );
  }, [allStudents, selectedClass, academicYear]);

  // No class selected -> report covers every student (whole madrasa) for
  // the month, so name lookups fall back to the full roster instead of
  // just one class's.
  const reportStudents = useMemo(() => {
    if (selectedClass) return studentsInClass;
    return allStudents.filter((student) => String(student.academic_year) === academicYear);
  }, [selectedClass, studentsInClass, allStudents, academicYear]);

  const studentNameById = useMemo(() => {
    const map = new Map<string, { name: string; roll: number | string }>();
    for (const student of reportStudents) {
      map.set(String(student.id), { name: student.name_bn || "নাম নেই", roll: student.roll ?? "-" });
    }
    return map;
  }, [reportStudents]);

  const loadReport = useCallback(async () => {
    if (!month) return;
    const { from, to } = monthRange(month);

    try {
      setReportLoading(true);
      setEditDate("");
      const res = await attendanceApi.list({
        from,
        to,
        ...(selectedClass ? { class_id: Number(selectedClass) } : {}),
        attendee_type: "STUDENT",
      });
      setRecords(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD ATTENDANCE REPORT ERROR:", err);
      useToastStore.getState().show("রিপোর্ট লোড করতে সমস্যা হয়েছে", "error");
      setRecords([]);
    } finally {
      setReportLoading(false);
    }
  }, [selectedClass, month]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // Date -> per-status counts, newest first.
  const dailySummary = useMemo(() => {
    const byDate = new Map<string, { PRESENT: number; ABSENT: number; LATE: number; LEAVE: number }>();
    for (const row of records) {
      const dateKey = String(row.date).slice(0, 10);
      if (!byDate.has(dateKey)) byDate.set(dateKey, { PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0 });
      const counts = byDate.get(dateKey)!;
      if (row.status in counts) counts[row.status] += 1;
    }
    return Array.from(byDate.entries())
      .map(([date, counts]) => ({
        date,
        ...counts,
        total: counts.PRESENT + counts.ABSENT + counts.LATE + counts.LEAVE,
      }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [records]);

  const overall = useMemo(() => {
    const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0 };
    for (const row of records) {
      if (row.status in counts) counts[row.status] += 1;
    }
    const total = counts.PRESENT + counts.ABSENT + counts.LATE + counts.LEAVE;
    const rate = total > 0 ? Math.round(((counts.PRESENT + counts.LATE) / total) * 1000) / 10 : 0;
    return { ...counts, total, rate, days: dailySummary.length };
  }, [records, dailySummary.length]);

  const classNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const classItem of allClasses) map.set(String(classItem.class_id), classItem.class_name_bn);
    return map;
  }, [allClasses]);

  const studentClassById = useMemo(() => {
    const map = new Map<string, string>();
    for (const student of allStudents) {
      if (String(student.academic_year) !== academicYear) continue;
      if (student.class_id === undefined || student.class_id === null) continue;
      map.set(String(student.id), String(student.class_id));
    }
    return map;
  }, [allStudents, academicYear]);

  // Class-wise breakdown for the no-class-selected dashboard: how each class
  // is doing this month, so an admin can spot a struggling class at a glance
  // instead of only seeing a whole-madrasa total.
  const classSummary = useMemo(() => {
    if (selectedClass) return [];

    const byClass = new Map<
      string,
      { PRESENT: number; ABSENT: number; LATE: number; LEAVE: number; dates: Set<string> }
    >();
    for (const row of records) {
      const classId = studentClassById.get(String(row.attendeeId));
      if (!classId) continue;
      if (!byClass.has(classId)) {
        byClass.set(classId, { PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0, dates: new Set() });
      }
      const counts = byClass.get(classId)!;
      if (row.status in counts) counts[row.status] += 1;
      counts.dates.add(String(row.date).slice(0, 10));
    }

    return Array.from(byClass.entries())
      .map(([classId, { dates, ...counts }]) => {
        const total = counts.PRESENT + counts.ABSENT + counts.LATE + counts.LEAVE;
        const rate = total > 0 ? Math.round(((counts.PRESENT + counts.LATE) / total) * 1000) / 10 : 0;
        const classItem = allClasses.find((c) => String(c.class_id) === classId);
        return {
          classId,
          className: classNameById.get(classId) || `ক্লাস #${classId}`,
          classItem,
          ...counts,
          total,
          rate,
          days: dates.size,
        };
      })
      .sort((a, b) => a.className.localeCompare(b.className, "bn"));
  }, [records, studentClassById, classNameById, allClasses, selectedClass]);

  const topAbsentees = useMemo(() => {
    const byStudent = new Map<string, number>();
    for (const row of records) {
      if (row.status !== "ABSENT") continue;
      const key = String(row.attendeeId);
      byStudent.set(key, (byStudent.get(key) || 0) + 1);
    }
    return Array.from(byStudent.entries())
      .map(([studentId, absentCount]) => {
        const classId = studentClassById.get(studentId);
        return {
          studentId,
          absentCount,
          info: studentNameById.get(studentId),
          className: classId ? classNameById.get(classId) : undefined,
        };
      })
      .filter((row) => row.info)
      .sort((a, b) => b.absentCount - a.absentCount)
      .slice(0, 5);
  }, [records, studentNameById, studentClassById, classNameById]);

  const openEditForDate = (date: string) => {
    setEditDate(date);
    const recordsForDate = records.filter((row) => String(row.date).slice(0, 10) === date);
    const existingByStudent = new Map(recordsForDate.map((row) => [String(row.attendeeId), row]));

    const next: Record<string, boolean> = {};
    for (const student of studentsInClass) {
      const existing = existingByStudent.get(String(student.id));
      next[String(student.id)] = existing ? existing.status === "PRESENT" : true;
    }
    setEditPresentByStudent(next);
  };

  const toggleEditPresent = (studentId: number | string) => {
    const key = String(studentId);
    setEditPresentByStudent((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const editAllChecked = useMemo(() => {
    const ids = studentsInClass.map((student) => String(student.id));
    return ids.length > 0 && ids.every((id) => editPresentByStudent[id]);
  }, [studentsInClass, editPresentByStudent]);

  const toggleEditCheckAll = () => {
    const ids = studentsInClass.map((student) => String(student.id));
    const nextValue = !editAllChecked;
    setEditPresentByStudent((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = nextValue;
      return next;
    });
  };

  const handleSaveEdit = async () => {
    if (!selectedClass || !editDate) return;
    const entries = studentsInClass.map((student) => ({
      attendee_id: Number(student.id),
      status: (editPresentByStudent[String(student.id)] ? "PRESENT" : "ABSENT") as AttendanceStatus,
    }));

    try {
      setEditSaving(true);
      await attendanceApi.bulkMark({
        attendee_type: "STUDENT",
        date: editDate,
        class_id: Number(selectedClass),
        entries,
      });
      useToastStore.getState().show("উপস্থিতি হালনাগাদ করা হয়েছে", "success");
      setEditDate("");
      loadReport();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "হালনাগাদ করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="উপস্থিতি রিপোর্ট"
        subtitle="ক্লাস নির্বাচন না করলে পুরো মাদ্রাসার সারাংশ দেখাবে; নির্দিষ্ট বিভাগ/শ্রেণি বাছাই করলে শুধু সেটির রিপোর্ট ও এডিট অপশন দেখাবে"
      />

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
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
            <option value="">{classLoading ? "শ্রেণি লোড হচ্ছে..." : "শ্রেণি নির্বাচন করুন"}</option>
            {classes.map((classItem) => (
              <option key={classItem.class_id} value={classItem.class_id}>
                {classItem.class_name_bn}
              </option>
            ))}
          </select>

          <input
            type="month"
            value={month}
            max={currentMonth()}
            onChange={(event) => setMonth(event.target.value)}
            className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[160px]"
          />
        </div>
      </div>

      {reportLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <SkeletonList items={5} />
        </div>
      ) : (
        <>
          {/* Dashboard */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="উপস্থিতির হার" value={overall.rate} variant="percentage" tone="blue" />
            <StatTile label="মোট উপস্থিত" value={overall.PRESENT} tone="emerald" />
            <StatTile label="মোট অনুপস্থিত" value={overall.ABSENT} tone="rose" />
            <StatTile label="উপস্থিতি নেওয়া হয়েছে" value={overall.days} subLabel="দিন" tone="indigo" />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {selectedClass ? (
              /* Day-wise summary for the one selected class, with per-day edit */
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:col-span-2">
                <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">দিনভিত্তিক সারাংশ</h2>
                </div>
                {dailySummary.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-400">এই মাসে কোনো উপস্থিতি রেকর্ড নেই</div>
                ) : (
                  <div className="max-h-[420px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-slate-50 text-left text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        <tr>
                          <th className="px-5 py-2.5 font-medium">তারিখ</th>
                          <th className="px-3 py-2.5 text-center font-medium text-green-700 dark:text-green-400">উপস্থিত</th>
                          <th className="px-3 py-2.5 text-center font-medium text-red-700 dark:text-red-400">অনুপস্থিত</th>
                          <th className="px-3 py-2.5"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailySummary.map((day) => (
                          <tr key={day.date} className="border-t border-slate-100 dark:border-slate-800">
                            <td className="px-5 py-2.5 text-slate-700 dark:text-slate-300">{formatBnDate(day.date)}</td>
                            <td className="px-3 py-2.5 text-center text-green-700 dark:text-green-400">
                              {day.PRESENT + day.LATE}
                            </td>
                            <td className="px-3 py-2.5 text-center text-red-700 dark:text-red-400">{day.ABSENT}</td>
                            <td className="px-3 py-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => openEditForDate(day.date)}
                                className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-950/50"
                              >
                                এডিট
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Backfill / edit any date, including ones with no record yet */}
                <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
                  <span className="text-xs text-slate-500 dark:text-slate-400">অন্য কোনো তারিখ এডিট করুন:</span>
                  <input
                    type="date"
                    max={todayIso()}
                    onChange={(event) => event.target.value && openEditForDate(event.target.value)}
                    className="h-8 rounded-md border border-gray-300 px-2 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
            ) : (
              /* Class-wise summary across the whole madrasa - click a row to drill
                 into that class's day-wise detail and edit capability. */
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:col-span-2">
                <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">ক্লাসভিত্তিক সারাংশ</h2>
                </div>
                {classSummary.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-400">এই মাসে কোনো উপস্থিতি রেকর্ড নেই</div>
                ) : (
                  <div className="max-h-[420px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-slate-50 text-left text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        <tr>
                          <th className="px-5 py-2.5 font-medium">শ্রেণি</th>
                          <th className="px-3 py-2.5 text-center font-medium text-green-700 dark:text-green-400">উপস্থিত</th>
                          <th className="px-3 py-2.5 text-center font-medium text-red-700 dark:text-red-400">অনুপস্থিত</th>
                          <th className="px-3 py-2.5 text-center font-medium">হার</th>
                          <th className="px-3 py-2.5 text-center font-medium">হাজিরার দিন</th>
                          <th className="px-3 py-2.5"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {classSummary.map((row) => (
                          <tr key={row.classId} className="border-t border-slate-100 dark:border-slate-800">
                            <td className="px-5 py-2.5 text-slate-700 dark:text-slate-300">{row.className}</td>
                            <td className="px-3 py-2.5 text-center text-green-700 dark:text-green-400">
                              {row.PRESENT + row.LATE}
                            </td>
                            <td className="px-3 py-2.5 text-center text-red-700 dark:text-red-400">{row.ABSENT}</td>
                            <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-400">
                              {row.rate}%
                            </td>
                            <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-400">
                              {row.days}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <button
                                type="button"
                                disabled={!row.classItem}
                                onClick={() => row.classItem && openClassDetail(row.classItem)}
                                className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-950/50"
                              >
                                বিস্তারিত
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400 dark:border-slate-800">
                  কোনো নির্দিষ্ট দিনের উপস্থিতি এডিট করতে উপরে বিভাগ ও শ্রেণি নির্বাচন করুন, অথবা কোনো ক্লাসের পাশে "বিস্তারিত" চাপুন
                </div>
              </div>
            )}

            {/* Top absentees */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">সর্বাধিক অনুপস্থিত</h2>
              </div>
              {topAbsentees.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-400">এই মাসে কোনো অনুপস্থিতি নেই</div>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {topAbsentees.map((row) => (
                    <li key={row.studentId} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
                      <span className="min-w-0 truncate text-slate-700 dark:text-slate-300">
                        <span className="mr-2 text-slate-400">{row.info?.roll}</span>
                        {row.info?.name}
                        {row.className && (
                          <span className="ml-2 text-xs text-slate-400">({row.className})</span>
                        )}
                      </span>
                      <span className="shrink-0 font-semibold text-red-700 dark:text-red-400">
                        {row.absentCount} দিন
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Edit panel */}
          {editDate && (
            <div className="rounded-2xl border border-blue-200 bg-white shadow-sm dark:border-blue-900/50 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {formatBnDate(editDate)} - উপস্থিতি এডিট
                </h2>
                <button
                  type="button"
                  onClick={() => setEditDate("")}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  বন্ধ করুন
                </button>
              </div>

              {studentsInClass.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">এই শ্রেণিতে কোনো ছাত্র নেই</div>
              ) : (
                <div className="mx-auto max-w-md p-4 sm:p-5">
                  <label className="flex cursor-pointer items-center justify-between gap-3 border-b border-gray-200 pb-2 text-sm font-medium text-gray-700 dark:border-slate-700 dark:text-slate-200">
                    <span>সবাইকে উপস্থিত করুন</span>
                    <input
                      type="checkbox"
                      checked={editAllChecked}
                      onChange={toggleEditCheckAll}
                      className="h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
                    />
                  </label>

                  <div className="divide-y divide-gray-100 dark:divide-slate-800">
                    {studentsInClass
                      .slice()
                      .sort((a, b) => Number(a.roll || 0) - Number(b.roll || 0))
                      .map((student) => {
                        const isPresent = editPresentByStudent[String(student.id)] ?? true;
                        return (
                          <label
                            key={student.id}
                            className="flex cursor-pointer items-center justify-between gap-3 py-2.5"
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
                              onChange={() => toggleEditPresent(student.id)}
                              className="h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
                            />
                          </label>
                        );
                      })}
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      disabled={editSaving}
                      onClick={handleSaveEdit}
                      className="h-10 w-full rounded-lg bg-blue-600 px-6 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
                    >
                      {editSaving ? "সংরক্ষণ হচ্ছে..." : "পরিবর্তন সংরক্ষণ করুন"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AttendanceReportPage;
