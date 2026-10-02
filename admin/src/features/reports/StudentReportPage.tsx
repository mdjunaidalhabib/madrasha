import ReportShell, { ReportMenuItem } from "./ReportShell";
import { useLocalizedReports, type ReportBuilder } from "./useLocalizedReports";

const idCol = "w-24 min-w-24 max-w-24 text-center";
const nameCol = "min-w-56";
const midCol = "min-w-40";
const smallCol = "min-w-32";

const buildReports: ReportBuilder = (t, col): ReportMenuItem[] => [
  {
    key: "student-admissions",
    ...t.r["student-admissions"],
    endpoint: "/reports/academic/admissions",
    printable: "student-admission-list",
    requiresDivision: true,
    columns: [
      { header: col.rollNo, key: "roll", className: smallCol },
      { header: col.regNoFull, key: "registration_no", className: idCol },
      { header: col.studentName, key: "student_name", className: nameCol },
      { header: col.father, key: "father_name", className: "min-w-44" },
      { header: col.mother, key: "mother_name", className: "min-w-44" },
      { header: col.class, key: "class_name", className: smallCol },
      { header: col.division, key: "division_name", className: midCol },
      { header: col.mobile, key: "guardian_phone", className: midCol },
      { header: col.district, key: "district", className: midCol },
    ],
  },
  {
    key: "student-guardian-phones",
    ...t.r["student-guardian-phones"],
    endpoint: "/reports/academic/guardian-phones",
    printable: "guardian-phone-list",
    requiresDivision: true,
    columns: [
      { header: col.rollNo, key: "roll", className: smallCol },
      { header: col.regNoFull, key: "registration_no", className: idCol },
      { header: col.studentName, key: "student_name", className: nameCol },
      { header: col.father, key: "father_name", className: "min-w-44" },
      { header: col.mobile, key: "guardian_phone", className: midCol },
      { header: col.session, key: "academic_year", className: smallCol },
    ],
  },
];

// আইডি কার্ড, প্রবেশপত্র, সনদ, প্রত্যয়ন পত্র, ছাড়পত্র ও মার্কশিট এখন "ডকুমেন্ট সমূহ" পেজে
// (reports/documents) সরিয়ে নেওয়া হয়েছে।
const StudentReportPage = ({ printMode }: { printMode?: boolean }) => {
  const { reports, printReports } = useLocalizedReports(buildReports);
  return (
    <ReportShell
      reports={reports}
      printReports={printReports}
      reportsPageKey="student"
      printMode={printMode}
    />
  );
};

export default StudentReportPage;
