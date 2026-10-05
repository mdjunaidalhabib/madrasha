import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { History, Settings2 } from "lucide-react";
import { cachedGet } from "../../services/api";
import {
  attendanceApi,
  type AttendanceCalendar,
  type AttendanceStats,
  type AttendanceStatus,
} from "../../services/phase1Api";
import { AttendanceHistoryModal } from "./AttendanceShared";
import { localIsoDate } from "./attendanceUtils";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import StatTile from "@madrasha/shared-ui/src/components/ui/StatTile";
import { SkeletonList } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { formatDate, formatNumber, getText, useLang, useText, type Lang } from "@madrasha/shared-ui/src/i18n";
import { attendanceText } from "./attendance.text";

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

const todayIso = () => localIsoDate();
const currentMonth = () => localIsoDate().slice(0, 7);

const monthRange = (month: string) => {
  const [year, monthNum] = month.split("-").map(Number);
  const from = `${month}-01`;
  const lastDay = new Date(year, monthNum, 0).getDate();
  const to = `${month}-${String(lastDay).padStart(2, "0")}`;
  return { from, to: to > todayIso() ? todayIso() : to };
};

const formatBnDate = (iso: string, lang: Lang) => {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return formatDate(date, lang, { year: "numeric", month: "long", day: "numeric" });
};

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data.filter((item) => item && typeof item === "object") : [];
};

const AttendanceReportPage = () => {
  const lang = useLang();
  const tx = useText(attendanceText);
  const t = tx.report;
  const navigate = useNavigate();
  const num = (n: number) => formatNumber(n, lang);
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

  const [calendar, setCalendar] = useState<AttendanceCalendar | null>(null);
  const [stats, setStats] = useState<Array<AttendanceStats & { attendee_id: number }>>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsFailed, setStatsFailed] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<{
    attendeeType: "STUDENT";
    attendeeId: number;
    name: string;
  } | null>(null);

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
      map.set(String(student.id), { name: student.name_bn || tx.common.noName, roll: student.roll ?? "-" });
    }
    return map;
  }, [reportStudents, tx]);

  const loadReport = useCallback(async () => {
    if (!month) return;
    const { from, to } = monthRange(month);

    try {
      setReportLoading(true);
      const res = await attendanceApi.list({
        from,
        to,
        ...(selectedClass ? { class_id: Number(selectedClass) } : {}),
        attendee_type: "STUDENT",
      });
      setRecords(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD ATTENDANCE REPORT ERROR:", err);
      useToastStore.getState().show(getText(attendanceText).report.loadFailed, "error");
      setRecords([]);
    } finally {
      setReportLoading(false);
    }
  }, [selectedClass, month]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // Working / off days of the month (weekly off + holidays removed).
  useEffect(() => {
    if (!month) return;
    const { from, to } = monthRange(month);
    let alive = true;
    attendanceApi
      .calendar(from, to)
      .then((cal) => alive && setCalendar(cal))
      .catch((err) => {
        logger.error("LOAD ATTENDANCE CALENDAR ERROR:", err);
        if (alive) setCalendar(null);
      });
    return () => {
      alive = false;
    };
  }, [month]);

  // Per-student working-day stats (the official percentage) for the selected class.
  useEffect(() => {
    if (!month || !selectedClass) {
      setStats([]);
      return;
    }
    const { from, to } = monthRange(month);
    let alive = true;
    setStatsLoading(true);
    setStatsFailed(false);
    attendanceApi
      .stats({ attendee_type: "STUDENT", from, to, class_id: Number(selectedClass) })
      .then((rows) => alive && setStats(rows))
      .catch((err) => {
        logger.error("LOAD ATTENDANCE STATS ERROR:", err);
        if (alive) {
          setStats([]);
          setStatsFailed(true);
        }
      })
      .finally(() => alive && setStatsLoading(false));
    return () => {
      alive = false;
    };
  }, [month, selectedClass]);

  const offDayTitle = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of calendar?.off_days || []) map.set(String(d.date).slice(0, 10), d.title || "");
    return map;
  }, [calendar]);

  const statsTotals = useMemo(() => {
    if (stats.length === 0) return null;
    let unmarked = 0;
    let latePenalty = 0;
    let pctSum = 0;
    let workingDays = 0;
    for (const row of stats) {
      unmarked += Number(row.unmarked || 0);
      latePenalty += Number(row.late_penalty || 0);
      pctSum += Number(row.percentage || 0);
      workingDays = Math.max(workingDays, Number(row.working_days || 0));
    }
    return {
      unmarked,
      latePenalty,
      workingDays,
      avgPercentage: Math.round((pctSum / stats.length) * 10) / 10,
    };
  }, [stats]);

  const statsRows = useMemo(
    () =>
      stats
        .map((row) => ({ ...row, info: studentNameById.get(String(row.attendee_id)) }))
        .sort((a, b) => Number(a.info?.roll ?? 0) - Number(b.info?.roll ?? 0)),
    [stats, studentNameById],
  );

  const openMarkPage = (date: string) => {
    const params = new URLSearchParams({ type: "STUDENT", date });
    if (selectedDivision) params.set("division", selectedDivision);
    if (selectedClass) params.set("class", selectedClass);
    navigate(`/attendance/mark?${params.toString()}`);
  };

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
          className: classNameById.get(classId) || t.classFallback(classId),
          classItem,
          ...counts,
          total,
          rate,
          days: dates.size,
        };
      })
      .sort((a, b) => a.className.localeCompare(b.className, "bn"));
  }, [records, studentClassById, classNameById, allClasses, selectedClass, t]);

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

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <Link
            to="/attendance/policy"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Settings2 size={15} />
            {t.policyLink}
          </Link>
        }
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
            <option value="">{tx.common.selectDivision}</option>
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
            <option value="">{classLoading ? tx.common.classLoading : tx.common.selectClass}</option>
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
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatTile
              label={t.rate}
              value={selectedClass && statsTotals ? statsTotals.avgPercentage : overall.rate}
              variant="percentage"
              tone="blue"
            />
            <StatTile label={t.totalPresent} value={overall.PRESENT + overall.LATE} tone="emerald" />
            <StatTile label={t.totalAbsent} value={overall.ABSENT} tone="rose" />
            <StatTile
              label={t.workingDays}
              value={calendar ? calendar.working_days.length : statsTotals?.workingDays ?? 0}
              subLabel={calendar ? t.offDays(num(calendar.off_days.length)) : undefined}
              tone="indigo"
            />
            <StatTile label={t.daysTaken} value={overall.days} subLabel={t.days} tone="slate" size="sm" />
            <StatTile
              label={`${tx.common.late} / ${tx.common.leave}`}
              value={`${num(overall.LATE)} / ${num(overall.LEAVE)}`}
              tone="amber"
              size="sm"
            />
            {selectedClass && statsTotals && (
              <>
                <StatTile label={t.unmarked} value={statsTotals.unmarked} subLabel={t.unmarkedHint} tone="slate" size="sm" />
                <StatTile label={t.latePenalty} value={statsTotals.latePenalty} subLabel={t.latePenaltyHint} tone="amber" size="sm" />
              </>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {selectedClass ? (
              /* Day-wise summary for the one selected class, with per-day edit */
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:col-span-2">
                <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{t.daily}</h2>
                </div>
                {dailySummary.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-400">{t.noRecords}</div>
                ) : (
                  <div className="max-h-[420px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-slate-50 text-start text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        <tr>
                          <th className="px-5 py-2.5 font-medium">{t.date}</th>
                          <th className="px-3 py-2.5 text-center font-medium text-green-700 dark:text-green-400">{tx.common.present}</th>
                          <th className="px-3 py-2.5 text-center font-medium text-amber-700 dark:text-amber-400">{tx.common.late}</th>
                          <th className="px-3 py-2.5 text-center font-medium text-red-700 dark:text-red-400">{tx.common.absent}</th>
                          <th className="px-3 py-2.5 text-center font-medium text-sky-700 dark:text-sky-400">{tx.common.leave}</th>
                          <th className="px-3 py-2.5"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailySummary.map((day) => (
                          <tr key={day.date} className="border-t border-slate-100 dark:border-slate-800">
                            <td className="px-5 py-2.5 text-slate-700 dark:text-slate-300">
                              {formatBnDate(day.date, lang)}
                              {offDayTitle.has(day.date) && (
                                <span className="ms-1.5 rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                                  {offDayTitle.get(day.date) || tx.common.leave}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center text-green-700 dark:text-green-400">{num(day.PRESENT)}</td>
                            <td className="px-3 py-2.5 text-center text-amber-700 dark:text-amber-400">{num(day.LATE)}</td>
                            <td className="px-3 py-2.5 text-center text-red-700 dark:text-red-400">{num(day.ABSENT)}</td>
                            <td className="px-3 py-2.5 text-center text-sky-700 dark:text-sky-400">{num(day.LEAVE)}</td>
                            <td className="px-3 py-2.5 text-end">
                              <button
                                type="button"
                                onClick={() => openMarkPage(day.date)}
                                className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-950/50"
                              >
                                {t.edit}
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
                  <span className="text-xs text-slate-500 dark:text-slate-400">{t.editOtherDate}</span>
                  <input
                    type="date"
                    max={todayIso()}
                    onChange={(event) => event.target.value && openMarkPage(event.target.value)}
                    className="h-8 rounded-md border border-gray-300 px-2 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
            ) : (
              /* Class-wise summary across the whole madrasa - click a row to drill
                 into that class's day-wise detail and edit capability. */
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:col-span-2">
                <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{t.classWise}</h2>
                </div>
                {classSummary.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-400">{t.noRecords}</div>
                ) : (
                  <div className="max-h-[420px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-slate-50 text-start text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        <tr>
                          <th className="px-5 py-2.5 font-medium">{t.class}</th>
                          <th className="px-3 py-2.5 text-center font-medium text-green-700 dark:text-green-400">{tx.common.present}</th>
                          <th className="px-3 py-2.5 text-center font-medium text-red-700 dark:text-red-400">{tx.common.absent}</th>
                          <th className="px-3 py-2.5 text-center font-medium">{t.rateShort}</th>
                          <th className="px-3 py-2.5 text-center font-medium">{t.attendanceDays}</th>
                          <th className="px-3 py-2.5"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {classSummary.map((row) => (
                          <tr key={row.classId} className="border-t border-slate-100 dark:border-slate-800">
                            <td className="px-5 py-2.5 text-slate-700 dark:text-slate-300">{row.className}</td>
                            <td className="px-3 py-2.5 text-center text-green-700 dark:text-green-400">
                              {num(row.PRESENT + row.LATE)}
                            </td>
                            <td className="px-3 py-2.5 text-center text-red-700 dark:text-red-400">{num(row.ABSENT)}</td>
                            <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-400">
                              {num(row.rate)}%
                            </td>
                            <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-400">
                              {num(row.days)}
                            </td>
                            <td className="px-3 py-2.5 text-end">
                              <button
                                type="button"
                                disabled={!row.classItem}
                                onClick={() => row.classItem && openClassDetail(row.classItem)}
                                className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-950/50"
                              >
                                {t.details}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400 dark:border-slate-800">
                  {t.classHint}
                </div>
              </div>
            )}

            {/* Top absentees */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{t.topAbsent}</h2>
              </div>
              {topAbsentees.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-400">{t.noAbsence}</div>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {topAbsentees.map((row) => (
                    <li key={row.studentId} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
                      <span className="min-w-0 truncate text-slate-700 dark:text-slate-300">
                        <span className="me-2 text-slate-400">{row.info?.roll}</span>
                        {row.info?.name}
                        {row.className && (
                          <span className="ms-2 text-xs text-slate-400">({row.className})</span>
                        )}
                      </span>
                      <span className="shrink-0 font-semibold text-red-700 dark:text-red-400">
                        {t.dayCount(num(row.absentCount))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Student-wise working-day statistics */}
          {selectedClass && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{t.studentWise}</h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t.studentWiseHint}</p>
              </div>
              {statsLoading ? (
                <div className="p-4">
                  <SkeletonList items={4} />
                </div>
              ) : statsFailed ? (
                <div className="p-8 text-center text-sm text-rose-600 dark:text-rose-400">{t.statsFailed}</div>
              ) : statsRows.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">{t.noStats}</div>
              ) : (
                <div className="max-h-[520px] overflow-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      <tr>
                        <th className="px-3 py-2.5 text-start font-medium">{t.roll}</th>
                        <th className="px-3 py-2.5 text-start font-medium">{t.name}</th>
                        <th className="px-2 py-2.5 text-center font-medium text-green-700 dark:text-green-400">{tx.common.present}</th>
                        <th className="px-2 py-2.5 text-center font-medium text-amber-700 dark:text-amber-400">{tx.common.late}</th>
                        <th className="px-2 py-2.5 text-center font-medium text-red-700 dark:text-red-400">{tx.common.absent}</th>
                        <th className="px-2 py-2.5 text-center font-medium text-sky-700 dark:text-sky-400">{tx.common.leave}</th>
                        <th className="px-2 py-2.5 text-center font-medium" title={t.unmarkedHint}>{t.unmarked}</th>
                        <th className="px-2 py-2.5 text-center font-medium" title={t.latePenaltyHint}>{t.latePenalty}</th>
                        <th className="px-2 py-2.5 text-center font-medium">{t.rateShort}</th>
                        <th className="px-2 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {statsRows.map((row) => {
                        const pct = Number(row.percentage || 0);
                        const name = row.info?.name || `#${row.attendee_id}`;
                        return (
                          <tr key={row.attendee_id} className="border-t border-slate-100 dark:border-slate-800">
                            <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{row.info?.roll ?? "-"}</td>
                            <td className="px-3 py-2 text-slate-800 dark:text-slate-200">{name}</td>
                            <td className="px-2 py-2 text-center">{num(row.PRESENT)}</td>
                            <td className="px-2 py-2 text-center">{num(row.LATE)}</td>
                            <td className="px-2 py-2 text-center">{num(row.ABSENT)}</td>
                            <td className="px-2 py-2 text-center">{num(row.LEAVE)}</td>
                            <td className="px-2 py-2 text-center text-slate-500">{num(row.unmarked)}</td>
                            <td className="px-2 py-2 text-center text-slate-500">{num(row.late_penalty)}</td>
                            <td
                              className={`px-2 py-2 text-center font-semibold ${
                                pct >= 75
                                  ? "text-emerald-700 dark:text-emerald-400"
                                  : pct >= 50
                                    ? "text-amber-700 dark:text-amber-400"
                                    : "text-rose-700 dark:text-rose-400"
                              }`}
                            >
                              {num(pct)}%
                            </td>
                            <td className="px-2 py-2 text-end">
                              <button
                                type="button"
                                title={tx.common.history}
                                aria-label={tx.common.history}
                                onClick={() => setHistoryTarget({ attendeeType: "STUDENT", attendeeId: row.attendee_id, name })}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                              >
                                <History size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <AttendanceHistoryModal target={historyTarget} onClose={() => setHistoryTarget(null)} />
    </div>
  );
};

export default AttendanceReportPage;
