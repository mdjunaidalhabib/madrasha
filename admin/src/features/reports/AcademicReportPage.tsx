import {
  ACADEMIC_RESULT_COLUMN_OPTIONS,
  ACADEMIC_RESULT_COLUMNS,
} from "../../components/Report/academic/AcademicResultPrint";
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
    subtitle: "শিক্ষার্থীদের ফলাফল, গ্রেড, মেধাক্রম — রোল নম্বর অনুযায়ী সাজানো",
    endpoint: "/reports/academic/results",
    printable: "academic-result",
    defaultOrientation: "portrait",
    requiresExam: true,
    requiresDivision: true,
    columns: ACADEMIC_RESULT_COLUMNS,
    columnOptions: ACADEMIC_RESULT_COLUMN_OPTIONS,
  },
  {
    key: "academic-results-by-rank",
    title: "ফলাফল (মেধাক্রম অনুযায়ী)",
    subtitle: "শিক্ষার্থীদের ফলাফল, গ্রেড — মেধাক্রম (১ম, ২য়, ৩য় ...) অনুযায়ী সাজানো",
    endpoint: "/reports/academic/results-by-rank",
    printable: "academic-result",
    defaultOrientation: "portrait",
    requiresExam: true,
    requiresDivision: true,
    columns: ACADEMIC_RESULT_COLUMNS,
    columnOptions: ACADEMIC_RESULT_COLUMN_OPTIONS,
  },

  {
    key: "academic-results-pass-list",
    title: "পাশ তালিকা",
    subtitle: "যেসব শিক্ষার্থী কৃতকার্য (পাশ) হয়েছে তাদের তালিকা",
    endpoint: "/reports/academic/results-by-status",
    extraParams: { status: "PASS" },
    requiresExam: true,
    requiresDivision: true,
    columns: [
      { header: "রোল নম্বর", key: "roll", className: smallCol },
      { header: "রেজিঃ নম্বর", key: "registration_no", className: idCol },
      { header: "শিক্ষার্থীর নাম", key: "student_name", className: nameCol },
      { header: "শ্রেণি", key: "class_name", className: smallCol },
      { header: "মোট", key: "total", className: smallCol },
      { header: "গড়", key: "average", className: smallCol },
      { header: "গ্রেড", key: "madrasa_grade", className: smallCol },
      { header: "মেধাক্রম", key: "rank_no", className: smallCol },
    ],
  },
  {
    key: "academic-results-fail-list",
    title: "ফেল তালিকা",
    subtitle: "যেসব শিক্ষার্থী অকৃতকার্য (ফেল) হয়েছে তাদের তালিকা",
    endpoint: "/reports/academic/results-by-status",
    extraParams: { status: "FAIL" },
    requiresExam: true,
    requiresDivision: true,
    columns: [
      { header: "রোল নম্বর", key: "roll", className: smallCol },
      { header: "রেজিঃ নম্বর", key: "registration_no", className: idCol },
      { header: "শিক্ষার্থীর নাম", key: "student_name", className: nameCol },
      { header: "শ্রেণি", key: "class_name", className: smallCol },
      { header: "মোট", key: "total", className: smallCol },
      { header: "গড়", key: "average", className: smallCol },
      { header: "গ্রেড", key: "madrasa_grade", className: smallCol },
    ],
  },
  {
    key: "academic-subject-performance",
    title: "বিষয়ভিত্তিক ফলাফল বিশ্লেষণ",
    subtitle: "প্রতিটি বিষয়ে গড়, সর্বোচ্চ ও সর্বনিম্ন নম্বর — বিষয়ভিত্তিক পারফরম্যান্স",
    endpoint: "/reports/academic/subject-performance",
    requiresExam: true,
    requiresDivision: true,
    columns: [
      { header: "বিষয়", key: "subject_name", className: nameCol },
      { header: "পরীক্ষার্থী", key: "candidate_count", className: smallCol },
      { header: "অনুপস্থিত", key: "absent_count", className: smallCol },
      { header: "গড় নম্বর", key: "average_mark", className: smallCol },
      { header: "সর্বোচ্চ", key: "highest_mark", className: smallCol },
      { header: "সর্বনিম্ন", key: "lowest_mark", className: smallCol },
      { header: "কৃতকার্য", key: "pass_count", className: smallCol },
    ],
  },
  {
    key: "academic-exam-summary",
    title: "পরীক্ষার সারসংক্ষেপ",
    subtitle: "প্রতিটি শ্রেণির পরীক্ষার্থী সংখ্যা, পাশের হার, গড় নম্বর ও সর্বোচ্চ ফলাফলকারী",
    endpoint: "/reports/academic/exam-summary",
    requiresExam: true,
    columns: [
      { header: "শ্রেণি", key: "class_name", className: smallCol },
      { header: "বিভাগ", key: "division_name", className: midCol },
      { header: "পরীক্ষার্থী", key: "candidate_count", className: smallCol },
      { header: "পাশ", key: "pass_count", className: smallCol },
      { header: "ফেল", key: "fail_count", className: smallCol },
      { header: "অনুপস্থিত", key: "absent_count", className: smallCol },
      { header: "পাশের হার (%)", key: "pass_percentage", className: smallCol },
      { header: "গড় নম্বর", key: "average_mark", className: smallCol },
      { header: "সর্বোচ্চ ফলাফলকারী", key: "top_scorer_name", className: nameCol },
      { header: "প্রাপ্ত নম্বর", key: "top_scorer_total", className: smallCol },
    ],
  },
  {
    key: "academic-result-notice",
    title: "ফলাফল সারসংক্ষেপ",
    subtitle: "প্রকাশিত ফলাফলের প্রিন্টযোগ্য নোটিশ",
    endpoint: "/reports/academic/result-notice",
    printable: "result-notice",
    requiresExam: true,
    requiresDivision: true,
    columns: RESULT_NOTICE_COLUMNS,
  },
  {
    key: "academic-routines",
    title: "রুটিন",
    subtitle: "ক্লাস রুটিন, বিষয়, শিক্ষক, সময়",
    endpoint: "/reports/academic/routines",
    printable: "class-routine",
    requiresDivision: true,
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
      { header: "শিক্ষার্থীর নাম", key: "student_name", className: nameCol },
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
      { header: "শিক্ষার্থীর নাম", key: "student_name", className: nameCol },
      { header: "শ্রেণি", key: "class_name", className: smallCol },
      { header: "ইন টাইম", key: "check_in", className: smallCol },
      { header: "আউট টাইম", key: "check_out", className: smallCol },
      { header: "স্ট্যাটাস", key: "status", className: smallCol },
    ],
  },
];

const AcademicReportPage = ({ printMode }: { printMode?: boolean }) => (
  <ReportShell reports={reports} reportsPageKey="academic" printMode={printMode} />
);

export default AcademicReportPage;
