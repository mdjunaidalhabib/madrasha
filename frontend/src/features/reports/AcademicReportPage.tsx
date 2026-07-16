import ReportShell, { ReportMenuItem } from "./ReportShell";

const idCol = "w-24 min-w-24 max-w-24 text-center";
const nameCol = "min-w-56";
const midCol = "min-w-40";
const smallCol = "min-w-32";

const reports: ReportMenuItem[] = [
  {
    key: "academic-results",
    title: "ফলাফল",
    subtitle: "শিক্ষার্থীদের ফলাফল, গ্রেড, মেধাক্রম",
    endpoint: "/reports/academic/results",
    columns: [
      { header: "শিক্ষার্থী", key: "student_name", className: nameCol },
      { header: "শ্রেণি", key: "class_name", className: smallCol },
      { header: "মোট", key: "total", className: smallCol },
      { header: "গড়", key: "average", className: smallCol },
      { header: "গ্রেড", key: "general_grade", className: smallCol },
      { header: "মাদরাসা গ্রেড", key: "madrasa_grade", className: midCol },
      { header: "মেধাক্রম", key: "rank_no", className: smallCol },
      { header: "স্ট্যাটাস", key: "status", className: smallCol },
    ],
  },

  {
    key: "academic-result-notice",
    title: "রেজাল্ট নোটিশ",
    subtitle: "Academic Notice থেকে রেজাল্ট দেখার অপশন",
    endpoint: "/reports/academic/results",
    columns: [
      { header: "শিক্ষার্থী", key: "student_name", className: nameCol },
      { header: "শ্রেণি", key: "class_name", className: smallCol },
      { header: "মোট", key: "total", className: smallCol },
      { header: "গড়", key: "average", className: smallCol },
      { header: "গ্রেড", key: "general_grade", className: smallCol },
      { header: "স্ট্যাটাস", key: "status", className: smallCol },
    ],
  },
  {
    key: "academic-routines",
    title: "রুটিন",
    subtitle: "ক্লাস রুটিন, বিষয়, শিক্ষক, সময়",
    endpoint: "/reports/academic/routines",
    columns: [
      { header: "দিন", key: "day", className: smallCol },
      { header: "শুরু", key: "start_time", className: smallCol },
      { header: "শেষ", key: "end_time", className: smallCol },
      { header: "শ্রেণি", key: "class_name", className: smallCol },
      { header: "বিষয়", key: "subject_name", className: "min-w-44" },
      { header: "শিক্ষক", key: "teacher_name", className: "min-w-44" },
    ],
  },
  {
    key: "academic-admissions",
    title: "ভর্তি তালিকা",
    subtitle: "ভর্তিকৃত শিক্ষার্থীর পূর্ণ তালিকা",
    endpoint: "/reports/academic/admissions",
    columns: [
      { header: "আইডি", key: "id", className: idCol },
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
    key: "guardian-phones",
    title: "অভিভাবক মোবাইল নাম্বার",
    subtitle: "অভিভাবকদের যোগাযোগ তালিকা",
    endpoint: "/reports/academic/guardian-phones",
    columns: [
      { header: "আইডি", key: "id", className: idCol },
      { header: "শিক্ষার্থী", key: "student_name", className: nameCol },
      { header: "পিতা", key: "father_name", className: "min-w-44" },
      { header: "মোবাইল", key: "guardian_phone", className: midCol },
    ],
  },
  {
    key: "residential-attendance",
    title: "আবাসিক হাজিরা খাতা",
    subtitle: "শুধু শিক্ষার্থীর নাম দিয়ে A4 হাজিরা খাতা প্রিন্ট",
    endpoint: "/reports/academic/residential-attendance",
    printable: "attendance-register",
    columns: [
      { header: "আইডি", key: "id", className: idCol },
      { header: "শিক্ষার্থীর নাম", key: "student_name", className: "min-w-72" },
      { header: "শ্রেণি", key: "class_name", className: smallCol },
    ],
  },
  {
    key: "daily-attendance",
    title: "দৈনন্দিন হাজিরা খাতা",
    subtitle: "প্রতিদিনের উপস্থিতি তালিকা প্রিন্ট",
    endpoint: "/reports/academic/daily-attendance",
    printable: "daily-attendance-register",
    columns: [
      { header: "তারিখ", key: "date", className: midCol },
      { header: "শিক্ষার্থী", key: "student_name", className: nameCol },
      { header: "শ্রেণি", key: "class_name", className: smallCol },
      { header: "স্ট্যাটাস", key: "status", className: smallCol },
    ],
  },
  {
    key: "digital-attendance",
    title: "ডিজিটাল হাজিরা খাতা",
    subtitle: "ইন টাইম, আউট টাইম ও স্ট্যাটাসসহ ডিজিটাল হাজিরা রিপোর্ট",
    endpoint: "/reports/academic/digital-attendance",
    printable: "digital-attendance",
    columns: [
      { header: "তারিখ", key: "date", className: midCol },
      { header: "শিক্ষার্থী", key: "student_name", className: nameCol },
      { header: "শ্রেণি", key: "class_name", className: smallCol },
      { header: "ইন টাইম", key: "check_in", className: smallCol },
      { header: "আউট টাইম", key: "check_out", className: smallCol },
      { header: "স্ট্যাটাস", key: "status", className: smallCol },
    ],
  },
  {
    key: "academic-id-cards",
    title: "আইডি কার্ড",
    subtitle: "শিক্ষার্থীদের আইডি কার্ড প্রিন্ট",
    endpoint: "/reports/academic/id-cards",
    printable: "id-card",
    columns: [
      { header: "আইডি", key: "id", className: idCol },
      { header: "শিক্ষার্থী", key: "student_name", className: nameCol },
      { header: "পিতা", key: "father_name", className: "min-w-44" },
      { header: "শ্রেণি", key: "class_name", className: smallCol },
      { header: "বিভাগ", key: "division_name", className: midCol },
      { header: "মোবাইল", key: "guardian_phone", className: midCol },
    ],
  },
];

const AcademicReportPage = () => (
  <ReportShell
    pageTitle="একাডেমিক রিপোর্ট"
    pageSubtitle="ফলাফল, রেজাল্ট নোটিশ, রুটিন, ভর্তি তালিকা, অভিভাবক মোবাইল, হাজিরা এবং আইডি কার্ড এক জায়গায়।"
    accentTitle="Academic Reports"
    reports={reports}
  />
);

export default AcademicReportPage;
