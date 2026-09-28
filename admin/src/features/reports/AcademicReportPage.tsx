import {
  buildAcademicResultColumnOptions,
  buildAcademicResultColumns,
} from "../../components/Report/academic/AcademicResultPrint";
import { buildResultNoticeColumns } from "../../components/Report/academic/ResultNoticeList";
import ReportShell, { ReportMenuItem } from "./ReportShell";
import { useLocalizedReports, type ReportBuilder } from "./useLocalizedReports";

const idCol = "w-24 min-w-24 max-w-24 text-center";
const nameCol = "min-w-56";
const midCol = "min-w-40";
const smallCol = "min-w-32";

const buildReports: ReportBuilder = (t, col): ReportMenuItem[] => [
  {
    key: "academic-results",
    ...t.r["academic-results"],
    endpoint: "/reports/academic/results",
    printable: "academic-result",
    defaultOrientation: "portrait",
    requiresExam: true,
    requiresDivision: true,
    columns: buildAcademicResultColumns({ col }),
    columnOptions: buildAcademicResultColumnOptions({ col }),
  },
  {
    key: "academic-results-by-rank",
    ...t.r["academic-results-by-rank"],
    endpoint: "/reports/academic/results-by-rank",
    printable: "academic-result",
    defaultOrientation: "portrait",
    requiresExam: true,
    requiresDivision: true,
    columns: buildAcademicResultColumns({ col }),
    columnOptions: buildAcademicResultColumnOptions({ col }),
  },

  {
    key: "academic-results-pass-list",
    ...t.r["academic-results-pass-list"],
    endpoint: "/reports/academic/results-by-status",
    extraParams: { status: "PASS" },
    requiresExam: true,
    requiresDivision: true,
    columns: [
      { header: col.rollNo, key: "roll", className: smallCol },
      { header: col.regNo, key: "registration_no", className: idCol },
      { header: col.studentName, key: "student_name", className: nameCol },
      { header: col.class, key: "class_name", className: smallCol },
      { header: col.total, key: "total", className: smallCol },
      { header: col.average, key: "average", className: smallCol },
      { header: col.grade, key: "madrasa_grade", className: smallCol },
      { header: col.rank, key: "rank_no", className: smallCol },
    ],
  },
  {
    key: "academic-results-fail-list",
    ...t.r["academic-results-fail-list"],
    endpoint: "/reports/academic/results-by-status",
    extraParams: { status: "FAIL" },
    requiresExam: true,
    requiresDivision: true,
    columns: [
      { header: col.rollNo, key: "roll", className: smallCol },
      { header: col.regNo, key: "registration_no", className: idCol },
      { header: col.studentName, key: "student_name", className: nameCol },
      { header: col.class, key: "class_name", className: smallCol },
      { header: col.total, key: "total", className: smallCol },
      { header: col.average, key: "average", className: smallCol },
      { header: col.grade, key: "madrasa_grade", className: smallCol },
    ],
  },
  {
    key: "academic-subject-performance",
    ...t.r["academic-subject-performance"],
    endpoint: "/reports/academic/subject-performance",
    requiresExam: true,
    requiresDivision: true,
    columns: [
      { header: col.subject, key: "subject_name", className: nameCol },
      { header: col.examinees, key: "candidate_count", className: smallCol },
      { header: col.absent, key: "absent_count", className: smallCol },
      { header: col.averageMark, key: "average_mark", className: smallCol },
      { header: col.highest, key: "highest_mark", className: smallCol },
      { header: col.lowest, key: "lowest_mark", className: smallCol },
      { header: col.passed, key: "pass_count", className: smallCol },
    ],
  },
  {
    key: "academic-exam-summary",
    ...t.r["academic-exam-summary"],
    endpoint: "/reports/academic/exam-summary",
    requiresExam: true,
    columns: [
      { header: col.class, key: "class_name", className: smallCol },
      { header: col.division, key: "division_name", className: midCol },
      { header: col.examinees, key: "candidate_count", className: smallCol },
      { header: col.pass, key: "pass_count", className: smallCol },
      { header: col.fail, key: "fail_count", className: smallCol },
      { header: col.absent, key: "absent_count", className: smallCol },
      { header: col.passRate, key: "pass_percentage", className: smallCol },
      { header: col.averageMark, key: "average_mark", className: smallCol },
      { header: col.topScorer, key: "top_scorer_name", className: nameCol },
      { header: col.obtainedMarks, key: "top_scorer_total", className: smallCol },
    ],
  },
  {
    key: "academic-result-notice",
    ...t.r["academic-result-notice"],
    endpoint: "/reports/academic/result-notice",
    printable: "result-notice",
    requiresExam: true,
    requiresDivision: true,
    columns: buildResultNoticeColumns({ col }),
  },
  {
    key: "academic-routines",
    ...t.r["academic-routines"],
    endpoint: "/reports/academic/routines",
    printable: "class-routine",
    requiresDivision: true,
    columns: [
      { header: col.day, key: "day", className: smallCol },
      { header: col.start, key: "start_time", className: smallCol },
      { header: col.end, key: "end_time", className: smallCol },
      { header: col.class, key: "class_name", className: smallCol },
      { header: col.subject, key: "subject_name", className: "min-w-44" },
      { header: col.teacher, key: "teacher_name", className: "min-w-44" },
    ],
  },
  {
    key: "residential-attendance",
    ...t.r["residential-attendance"],
    endpoint: "/reports/academic/residential-attendance",
    printable: "attendance-register",
    columns: [
      { header: col.rollNo, key: "roll", className: smallCol },
      { header: col.regNoFull, key: "registration_no", className: idCol },
      { header: col.studentName, key: "student_name", className: "min-w-72" },
      { header: col.class, key: "class_name", className: smallCol },
    ],
  },
  {
    key: "daily-attendance",
    ...t.r["daily-attendance"],
    endpoint: "/reports/academic/daily-attendance",
    printable: "daily-attendance-register",
    columns: [
      { header: col.date, key: "date", className: midCol },
      { header: col.studentName, key: "student_name", className: nameCol },
      { header: col.class, key: "class_name", className: smallCol },
      { header: col.status, key: "status", className: smallCol },
    ],
  },
  {
    key: "digital-attendance",
    ...t.r["digital-attendance"],
    endpoint: "/reports/academic/digital-attendance",
    printable: "digital-attendance",
    columns: [
      { header: col.date, key: "date", className: midCol },
      { header: col.studentName, key: "student_name", className: nameCol },
      { header: col.class, key: "class_name", className: smallCol },
      { header: col.inTime, key: "check_in", className: smallCol },
      { header: col.outTime, key: "check_out", className: smallCol },
      { header: col.status, key: "status", className: smallCol },
    ],
  },
];

const AcademicReportPage = ({ printMode }: { printMode?: boolean }) => {
  const { reports, printReports } = useLocalizedReports(buildReports);
  return (
    <ReportShell reports={reports} printReports={printReports} reportsPageKey="academic" printMode={printMode} />
  );
};

export default AcademicReportPage;
