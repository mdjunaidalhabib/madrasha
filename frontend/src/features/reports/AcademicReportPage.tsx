import { ACADEMIC_RESULT_COLUMNS } from "../../components/Report/academic/AcademicResultPrint";
import { RESULT_NOTICE_COLUMNS } from "../../components/Report/academic/ResultNoticeList";
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
    printable: "academic-result",
    defaultOrientation: "portrait",
    columns: ACADEMIC_RESULT_COLUMNS,
  },

  {
    key: "academic-result-notice",
    title: "রেজাল্ট নোটিশ",
    subtitle: "প্রকাশিত ফলাফলের প্রিন্টযোগ্য নোটিশ",
    endpoint: "/reports/academic/result-notice",
    printable: "result-notice",
    columns: RESULT_NOTICE_COLUMNS,
  },
  {
    key: "academic-routines",
    title: "রুটিন",
    subtitle: "ক্লাস রুটিন, বিষয়, শিক্ষক, সময়",
    endpoint: "/reports/academic/routines",
    printable: "class-routine",
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
    key: "residential-attendance",
    title: "আবাসিক হাজিরা খাতা",
    subtitle: "শুধু শিক্ষার্থীর নাম দিয়ে A4 হাজিরা খাতা প্রিন্ট",
    endpoint: "/reports/academic/residential-attendance",
    printable: "attendance-register",
    columns: [
      { header: "রোল নম্বর", key: "roll", className: smallCol },
      { header: "রেজিস্ট্রেশন নম্বর", key: "registration_no", className: idCol },
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
];

const AcademicReportPage = () => (
  <ReportShell
    pageTitle="একাডেমিক রিপোর্ট"
    pageSubtitle="ফলাফল, রেজাল্ট নোটিশ, রুটিন এবং হাজিরা খাতা এক জায়গায়।"
    accentTitle="Academic Reports"
    reports={reports}
  />
);

export default AcademicReportPage;
