import ReportShell, { ReportMenuItem } from "./ReportShell";

const reports: ReportMenuItem[] = [
  {
    key: "teacher-list",
    title: "শিক্ষক লিস্ট",
    subtitle: "সকল শিক্ষকের পূর্ণ তালিকা",
    endpoint: "/reports/teacher/list",
    columns: [
      { header: "আইডি", key: "id" },
      { header: "শিক্ষক", key: "teacher_name" },
      { header: "পদবি", key: "designation" },
      { header: "বিভাগ", key: "division_name" },
      { header: "ডিপার্টমেন্ট", key: "department" },
      { header: "যোগ্যতা", key: "qualification" },
      { header: "মোবাইল", key: "phone" },
      { header: "ইমেইল", key: "email" },
      { header: "যোগদান", key: "joining_date" },
    ],
  },
  {
    key: "teacher-phones",
    title: "শিক্ষকদের মোবাইল নাম্বার",
    subtitle: "শিক্ষক ও অভিভাবক/জরুরি যোগাযোগ নাম্বার",
    endpoint: "/reports/teacher/phones",
    columns: [
      { header: "আইডি", key: "id" },
      { header: "শিক্ষক", key: "teacher_name" },
      { header: "পদবি", key: "designation" },
      { header: "বিভাগ", key: "division_name" },
      { header: "মোবাইল", key: "phone" },
      { header: "জরুরি মোবাইল", key: "parent_phone" },
    ],
  },
];

const TeacherReportPage = () => (
  <ReportShell
    pageTitle="শিক্ষক রিপোর্ট"
    pageSubtitle="শিক্ষক তালিকা ও মোবাইল নাম্বার database থেকে নিয়ে দ্রুত export/print করার সুবিধা।"
    accentTitle="Teacher Reports"
    reports={reports}
  />
);

export default TeacherReportPage;
