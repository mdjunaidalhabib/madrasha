import ReportShell, { ReportMenuItem } from "./ReportShell";
import { useLocalizedReports, type ReportBuilder } from "./useLocalizedReports";

const buildReports: ReportBuilder = (t, col): ReportMenuItem[] => [
  {
    key: "teacher-list",
    ...t.r["teacher-list"],
    endpoint: "/reports/teacher/list",
    printable: "teacher-list",
    requiresDivision: true,
    columns: [
      { header: col.regNoFull, key: "registration_no" },
      { header: col.teacher, key: "teacher_name" },
      { header: col.designation, key: "designation" },
      { header: col.division, key: "division_name" },
      { header: col.department, key: "department" },
      { header: col.qualification, key: "qualification" },
      { header: col.mobile, key: "phone" },
      { header: col.email, key: "email" },
      { header: col.joining, key: "joining_date" },
    ],
  },
  {
    key: "teacher-phones",
    ...t.r["teacher-phones"],
    endpoint: "/reports/teacher/phones",
    printable: "teacher-phone-list",
    requiresDivision: true,
    columns: [
      { header: col.regNoFull, key: "registration_no" },
      { header: col.teacher, key: "teacher_name" },
      { header: col.designation, key: "designation" },
      { header: col.division, key: "division_name" },
      { header: col.mobile, key: "phone" },
      { header: col.emergencyMobile, key: "parent_phone" },
    ],
  },
];

const TeacherReportPage = ({ printMode }: { printMode?: boolean }) => {
  const { reports, printReports } = useLocalizedReports(buildReports);
  return (
    <ReportShell
      reports={reports}
      printReports={printReports}
      reportsPageKey="teacher"
      printMode={printMode}
    />
  );
};

export default TeacherReportPage;
