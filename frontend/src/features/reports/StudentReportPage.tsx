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
    defaultOrientation: "landscape",
    columns: [
      { header: "রোল নম্বর", key: "roll", className: smallCol },
      { header: "রেজিস্ট্রেশন নম্বর", key: "registration_no", className: idCol },
      { header: "শিক্ষার্থী", key: "student_name", className: nameCol },
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
      { header: "শিক্ষার্থী", key: "student_name", className: nameCol },
      { header: "পিতা", key: "father_name", className: "min-w-44" },
      { header: "মোবাইল", key: "guardian_phone", className: midCol },
      { header: "শিক্ষাবর্ষ", key: "academic_year", className: smallCol },
    ],
  },
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
    pageSubtitle="ভর্তি তালিকা, অভিভাবক মোবাইল নাম্বার, মার্কশিট ও ফলাফল রিপোর্ট database থেকে নিয়ে professional ভাবে দেখুন ও প্রিন্ট করুন।"
    accentTitle="Student Reports"
    reports={reports}
  />
);

export default StudentReportPage;
