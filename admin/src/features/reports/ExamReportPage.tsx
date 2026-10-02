import ReportShell, { ReportMenuItem } from "./ReportShell";
import { useLocalizedReports, type ReportBuilder } from "./useLocalizedReports";

const idCol = "w-24 min-w-24 max-w-24 text-center";
const nameCol = "min-w-56";
const midCol = "min-w-40";
const smallCol = "min-w-32";

const buildReports: ReportBuilder = (t, col): ReportMenuItem[] => [
  {
    key: "exam-signature-sheet",
    ...t.r["exam-signature-sheet"],
    endpoint: "/reports/academic/exam-signature-sheet",
    printable: "exam-signature-sheet",
    requiresExam: true,
    requiresDivision: true,
    hasSubjectFilter: true,
    columns: [
      { header: col.rollNo, key: "roll", className: smallCol },
      { header: col.regNoFull, key: "registration_no", className: idCol },
      { header: col.studentName, key: "student_name", className: nameCol },
      { header: col.class, key: "class_name", className: smallCol },
      { header: col.division, key: "division_name", className: midCol },
      { header: col.exam, key: "exam_name", className: midCol },
      { header: col.session, key: "exam_year", className: smallCol },
    ],
  },
  {
    key: "exam-number-sheet",
    ...t.r["exam-number-sheet"],
    endpoint: "/reports/academic/exam-number-sheet",
    printable: "exam-number-sheet",
    requiresExam: true,
    requiresDivision: true,
    hasSubjectFilter: true,
    columns: [
      { header: col.roll, key: "roll", className: smallCol },
      { header: col.regNo, key: "registration_no", className: idCol },
      { header: col.studentName, key: "student_name", className: nameCol },
      { header: col.class, key: "class_name", className: smallCol },
      { header: col.division, key: "division_name", className: midCol },
      { header: col.exam, key: "exam_name", className: midCol },
      { header: col.total, key: "total", className: smallCol },
      { header: col.average, key: "average", className: smallCol },
    ],
  },
  {
    key: "exam-signature-number-sheet",
    ...t.r["exam-signature-number-sheet"],
    endpoint: "/reports/academic/exam-number-sheet",
    printable: "exam-signature-number-sheet",
    requiresExam: true,
    requiresDivision: true,
    hasSubjectFilter: true,
    columns: [
      { header: col.rollNo, key: "roll", className: smallCol },
      { header: col.regNoFull, key: "registration_no", className: idCol },
      { header: col.studentName, key: "student_name", className: nameCol },
      { header: col.class, key: "class_name", className: smallCol },
      { header: col.division, key: "division_name", className: midCol },
      { header: col.exam, key: "exam_name", className: midCol },
    ],
  },
  {
    key: "exam-signature-number-sheet-2col",
    ...t.r["exam-signature-number-sheet-2col"],
    endpoint: "/reports/academic/exam-number-sheet",
    printable: "exam-signature-number-sheet-2col",
    requiresExam: true,
    requiresDivision: true,
    hasSubjectFilter: true,
    columns: [
      { header: col.rollNo, key: "roll", className: smallCol },
      { header: col.regNoFull, key: "registration_no", className: idCol },
      { header: col.studentName, key: "student_name", className: nameCol },
      { header: col.class, key: "class_name", className: smallCol },
      { header: col.division, key: "division_name", className: midCol },
      { header: col.exam, key: "exam_name", className: midCol },
    ],
  },
  {
    key: "exam-routine",
    ...t.r["exam-routine"],
    endpoint: "/reports/academic/exam-routine",
    requiresExam: true,
    columns: [
      { header: col.date, key: "exam_date", className: smallCol },
      { header: col.start, key: "start_time", className: smallCol },
      { header: col.end, key: "end_time", className: smallCol },
      { header: col.subject, key: "subject_name", className: nameCol },
      { header: col.class, key: "class_name", className: smallCol },
      { header: col.division, key: "division_name", className: midCol },
      { header: col.roomNo, key: "room_no", className: smallCol },
    ],
  },
  {
    key: "exam-routine-by-room",
    ...t.r["exam-routine-by-room"],
    endpoint: "/reports/academic/exam-routine-by-room",
    requiresExam: true,
    columns: [
      { header: col.roomNo, key: "room_no", className: smallCol },
      { header: col.date, key: "exam_date", className: smallCol },
      { header: col.start, key: "start_time", className: smallCol },
      { header: col.end, key: "end_time", className: smallCol },
      { header: col.subject, key: "subject_name", className: nameCol },
      { header: col.class, key: "class_name", className: smallCol },
      { header: col.division, key: "division_name", className: midCol },
    ],
  },
  {
    key: "seat-plan",
    ...t.r["seat-plan"],
    endpoint: "/reports/academic/seat-plan",
    requiresExam: true,
    requiresDivision: true,
    columns: [
      { header: col.room, key: "room_name", className: smallCol },
      { header: col.date, key: "exam_date", className: smallCol },
      { header: col.subject, key: "subject_name", className: nameCol },
      { header: col.seatNo, key: "seat_no", className: smallCol },
      { header: col.roll, key: "roll", className: smallCol },
      { header: col.studentName, key: "student_name", className: nameCol },
      { header: col.class, key: "class_name", className: smallCol },
      { header: col.division, key: "division_name", className: midCol },
    ],
  },
  {
    key: "invigilator-list",
    ...t.r["invigilator-list"],
    endpoint: "/reports/academic/invigilator-list",
    requiresExam: true,
    columns: [
      { header: col.date, key: "exam_date", className: smallCol },
      { header: col.start, key: "start_time", className: smallCol },
      { header: col.end, key: "end_time", className: smallCol },
      { header: col.subject, key: "subject_name", className: nameCol },
      { header: col.room, key: "room_name", className: smallCol },
      { header: col.invigilatorName, key: "invigilator_name", className: nameCol },
      { header: col.mobile, key: "invigilator_phone", className: smallCol },
      { header: col.duty, key: "role", className: smallCol },
    ],
  },
  {
    key: "exam-attendance-sheet",
    ...t.r["exam-attendance-sheet"],
    endpoint: "/reports/academic/exam-attendance-sheet",
    requiresExam: true,
    requiresDivision: true,
    columns: [
      { header: col.room, key: "room_name", className: smallCol },
      { header: col.date, key: "exam_date", className: smallCol },
      { header: col.subject, key: "subject_name", className: nameCol },
      { header: col.roll, key: "roll", className: smallCol },
      { header: col.studentName, key: "student_name", className: nameCol },
      { header: col.state, key: "status", className: smallCol },
    ],
  },
  {
    key: "exam-candidates",
    ...t.r["exam-candidates"],
    endpoint: "/reports/academic/exam-candidates",
    requiresExam: true,
    requiresDivision: true,
    columns: [
      { header: col.rollNo, key: "roll", className: smallCol },
      { header: col.candidateNo, key: "exam_registration_no", className: idCol },
      { header: col.studentName, key: "student_name", className: nameCol },
      { header: col.fatherName, key: "father_name", className: nameCol },
      { header: col.class, key: "class_name", className: smallCol },
      { header: col.division, key: "division_name", className: midCol },
      { header: col.exam, key: "exam_name", className: midCol },
      { header: col.state, key: "candidate_status", className: smallCol },
      { header: col.eligibility, key: "eligibility_status", className: smallCol },
    ],
  },
  {
    key: "exam-absentees",
    ...t.r["exam-absentees"],
    endpoint: "/reports/academic/exam-absentees",
    requiresExam: true,
    requiresDivision: true,
    columns: [
      { header: col.rollNo, key: "roll", className: smallCol },
      { header: col.regNoFull, key: "registration_no", className: idCol },
      { header: col.studentName, key: "student_name", className: nameCol },
      { header: col.class, key: "class_name", className: smallCol },
      { header: col.division, key: "division_name", className: midCol },
      { header: col.subject, key: "subject_name", className: nameCol },
      { header: col.exam, key: "exam_name", className: midCol },
    ],
  },
];

const ExamReportPage = ({ printMode }: { printMode?: boolean }) => {
  const { reports, printReports } = useLocalizedReports(buildReports);
  return (
    <ReportShell
      reports={reports}
      printReports={printReports}
      reportsPageKey="exam"
      printMode={printMode}
    />
  );
};

export default ExamReportPage;
