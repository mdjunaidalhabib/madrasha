import ReportShell, { ReportMenuItem } from "./ReportShell";

const idCol = "w-24 min-w-24 max-w-24 text-center";
const nameCol = "min-w-56";
const midCol = "min-w-40";
const smallCol = "min-w-32";

const reports: ReportMenuItem[] = [
  {
    key: "student-admissions",
    title: "ভর্তি তালিকা",
    subtitle: "ভর্তিকৃত শিক্ষার্থীর পূর্ণ তালিকা",
    endpoint: "/reports/academic/admissions",
    printable: "student-admission-list",
    columns: [
      { header: "রোল নম্বর", key: "roll", className: smallCol },
      { header: "রেজিস্ট্রেশন নম্বর", key: "registration_no", className: idCol },
      { header: "শিক্ষার্থীর নাম", key: "student_name", className: nameCol },
      { header: "পিতা", key: "father_name", className: "min-w-44" },
      { header: "মাতা", key: "mother_name", className: "min-w-44" },
      { header: "শ্রেণি", key: "class_name", className: smallCol },
      { header: "বিভাগ", key: "division_name", className: midCol },
      { header: "মোবাইল", key: "guardian_phone", className: midCol },
      { header: "জেলা", key: "district", className: midCol },
    ],
  },
  {
    key: "student-guardian-phones",
    title: "অভিভাবক মোবাইল নাম্বার",
    subtitle: "অভিভাবকদের যোগাযোগ তালিকা",
    endpoint: "/reports/academic/guardian-phones",
    printable: "guardian-phone-list",
    columns: [
      { header: "রোল নম্বর", key: "roll", className: smallCol },
      { header: "রেজিস্ট্রেশন নম্বর", key: "registration_no", className: idCol },
      { header: "শিক্ষার্থীর নাম", key: "student_name", className: nameCol },
      { header: "পিতা", key: "father_name", className: "min-w-44" },
      { header: "মোবাইল", key: "guardian_phone", className: midCol },
      { header: "শিক্ষাবর্ষ", key: "academic_year", className: smallCol },
    ],
  },
];

// আইডি কার্ড, প্রবেশপত্র, সনদ, প্রত্যয়ন পত্র, ছাড়পত্র ও মার্কশিট এখন "ডকুমেন্ট সমূহ" পেজে
// (reports/documents) সরিয়ে নেওয়া হয়েছে।
const StudentReportPage = ({ printMode }: { printMode?: boolean }) => (
  <ReportShell
    pageTitle="স্টুডেন্ট রিপোর্ট"
    pageSubtitle="ভর্তি তালিকা ও অভিভাবক মোবাইল নাম্বার তালিকা database থেকে নিয়ে professional ভাবে দেখুন ও প্রিন্ট করুন।"
    accentTitle="Student Reports"
    reports={reports}
    reportsPageKey="student"
    printMode={printMode}
  />
);

export default StudentReportPage;
