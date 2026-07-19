import ReportShell, { ReportMenuItem } from "./ReportShell";

const reports: ReportMenuItem[] = [
  {
    key: "student-marksheets",
    title: "মার্কশিট",
    subtitle: "শিক্ষার্থীর ফলাফল ও মার্কশিট রিপোর্ট",
    endpoint: "/reports/student/marksheets",
    printable: "marksheet",
    columns: [
      { header: "রোল নম্বর", key: "roll" },
      { header: "রেজিস্ট্রেশন নম্বর", key: "registration_no" },
      { header: "শিক্ষার্থী", key: "student_name" },
      { header: "পরীক্ষা", key: "exam_name" },
      { header: "শ্রেণি", key: "class_name" },
      { header: "মোট", key: "total" },
      { header: "গড়", key: "average" },
      { header: "গ্রেড", key: "general_grade" },
      { header: "মাদরাসা গ্রেড", key: "madrasa_grade" },
      { header: "মেধাক্রম", key: "rank_no" },
      { header: "স্ট্যাটাস", key: "status" },
    ],
  },
];

// আইডি কার্ড, প্রবেশপত্র, সনদ, প্রত্যয়ন পত্র ও ছাড়পত্র এখন "ডকুমেন্ট সমূহ" পেজে
// (reports/documents) সরিয়ে নেওয়া হয়েছে।
const StudentReportPage = () => (
  <ReportShell
    pageTitle="স্টুডেন্ট রিপোর্ট"
    pageSubtitle="শিক্ষার্থীর মার্কশিট ও ফলাফল রিপোর্ট database থেকে নিয়ে professional ভাবে দেখুন ও প্রিন্ট করুন।"
    accentTitle="Student Reports"
    reports={reports}
  />
);

export default StudentReportPage;
