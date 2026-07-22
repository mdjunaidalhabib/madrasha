import ReportShell, { ReportMenuItem } from "./ReportShell";

const idCol = "w-24 min-w-24 max-w-24 text-center";
const nameCol = "min-w-56";
const midCol = "min-w-40";
const smallCol = "min-w-32";

const reports: ReportMenuItem[] = [
  {
    key: "exam-signature-sheet",
    title: "স্বাক্ষরপত্র",
    subtitle: "পরীক্ষার্থীদের স্বাক্ষর গ্রহণের জন্য প্রিন্টযোগ্য পত্র",
    endpoint: "/reports/academic/exam-signature-sheet",
    printable: "exam-signature-sheet",
    requiresExam: true,
    columns: [
      { header: "রোল নম্বর", key: "roll", className: smallCol },
      { header: "রেজিস্ট্রেশন নম্বর", key: "registration_no", className: idCol },
      { header: "শিক্ষার্থী", key: "student_name", className: nameCol },
      { header: "শ্রেণি", key: "class_name", className: smallCol },
      { header: "বিভাগ", key: "division_name", className: midCol },
      { header: "পরীক্ষা", key: "exam_name", className: midCol },
      { header: "শিক্ষাবর্ষ", key: "exam_year", className: smallCol },
    ],
  },
  {
    key: "exam-number-sheet",
    title: "নম্বরপত্র",
    subtitle: "বিষয়ভিত্তিক নম্বরসহ প্রিন্টযোগ্য পরীক্ষার নম্বরপত্র",
    endpoint: "/reports/academic/exam-number-sheet",
    printable: "exam-number-sheet",
    requiresExam: true,
    columns: [
      { header: "রোল নম্বর", key: "roll", className: smallCol },
      { header: "রেজিস্ট্রেশন নম্বর", key: "registration_no", className: idCol },
      { header: "শিক্ষার্থী", key: "student_name", className: nameCol },
      { header: "শ্রেণি", key: "class_name", className: smallCol },
      { header: "বিভাগ", key: "division_name", className: midCol },
      { header: "পরীক্ষা", key: "exam_name", className: midCol },
      { header: "মোট", key: "total", className: smallCol },
      { header: "গড়", key: "average", className: smallCol },
    ],
  },
];

const ExamReportPage = () => (
  <ReportShell
    pageTitle="পরীক্ষা রিপোর্ট"
    pageSubtitle="পরীক্ষা নির্বাচন করে স্বাক্ষরপত্র ও বিষয়ভিত্তিক নম্বরপত্র দেখুন এবং প্রিন্ট করুন।"
    accentTitle="Exam Reports"
    reports={reports}
  />
);

export default ExamReportPage;
