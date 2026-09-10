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
    requiresDivision: true,
    hasSubjectFilter: true,
    columns: [
      { header: "রোল নম্বর", key: "roll", className: smallCol },
      { header: "রেজিস্ট্রেশন নম্বর", key: "registration_no", className: idCol },
      { header: "শিক্ষার্থীর নাম", key: "student_name", className: nameCol },
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
    requiresDivision: true,
    hasSubjectFilter: true,
    columns: [
      { header: "রোল", key: "roll", className: smallCol },
      { header: "রেজিঃ নম্বর", key: "registration_no", className: idCol },
      { header: "শিক্ষার্থীর নাম", key: "student_name", className: nameCol },
      { header: "শ্রেণি", key: "class_name", className: smallCol },
      { header: "বিভাগ", key: "division_name", className: midCol },
      { header: "পরীক্ষা", key: "exam_name", className: midCol },
      { header: "মোট", key: "total", className: smallCol },
      { header: "গড়", key: "average", className: smallCol },
    ],
  },
  {
    key: "exam-signature-number-sheet",
    title: "স্বাক্ষর ও নম্বরপত্র",
    subtitle: "বিষয়ভিত্তিক আলাদা পত্র — স্বাক্ষর ও হাতে-নম্বর তোলার জন্য",
    endpoint: "/reports/academic/exam-number-sheet",
    printable: "exam-signature-number-sheet",
    requiresExam: true,
    requiresDivision: true,
    hasSubjectFilter: true,
    columns: [
      { header: "রোল নম্বর", key: "roll", className: smallCol },
      { header: "রেজিস্ট্রেশন নম্বর", key: "registration_no", className: idCol },
      { header: "শিক্ষার্থীর নাম", key: "student_name", className: nameCol },
      { header: "শ্রেণি", key: "class_name", className: smallCol },
      { header: "বিভাগ", key: "division_name", className: midCol },
      { header: "পরীক্ষা", key: "exam_name", className: midCol },
    ],
  },
  {
    key: "exam-signature-number-sheet-2col",
    title: "স্বাক্ষর ও নম্বরপত্র (২ কলাম)",
    subtitle: "এক পাতায় ২ কলামে ২টি শ্রেণির স্বাক্ষর ও নম্বর তোলার পত্র — কাগজ সাশ্রয়ী",
    endpoint: "/reports/academic/exam-number-sheet",
    printable: "exam-signature-number-sheet-2col",
    requiresExam: true,
    requiresDivision: true,
    hasSubjectFilter: true,
    columns: [
      { header: "রোল নম্বর", key: "roll", className: smallCol },
      { header: "রেজিস্ট্রেশন নম্বর", key: "registration_no", className: idCol },
      { header: "শিক্ষার্থীর নাম", key: "student_name", className: nameCol },
      { header: "শ্রেণি", key: "class_name", className: smallCol },
      { header: "বিভাগ", key: "division_name", className: midCol },
      { header: "পরীক্ষা", key: "exam_name", className: midCol },
    ],
  },
  {
    key: "exam-routine",
    title: "পরীক্ষার রুটিন",
    subtitle: "তারিখ ও সময় অনুযায়ী সাজানো প্রিন্টযোগ্য পরীক্ষার সময়সূচি",
    endpoint: "/reports/academic/exam-routine",
    requiresExam: true,
    columns: [
      { header: "তারিখ", key: "exam_date", className: smallCol },
      { header: "শুরু", key: "start_time", className: smallCol },
      { header: "শেষ", key: "end_time", className: smallCol },
      { header: "বিষয়", key: "subject_name", className: nameCol },
      { header: "শ্রেণি", key: "class_name", className: smallCol },
      { header: "বিভাগ", key: "division_name", className: midCol },
      { header: "রুম নং", key: "room_no", className: smallCol },
    ],
  },
  {
    key: "exam-routine-by-room",
    title: "রুম ভিত্তিক পরীক্ষার রুটিন",
    subtitle: "রুম নম্বর অনুযায়ী সাজানো প্রিন্টযোগ্য পরীক্ষার সময়সূচি",
    endpoint: "/reports/academic/exam-routine-by-room",
    requiresExam: true,
    columns: [
      { header: "রুম নং", key: "room_no", className: smallCol },
      { header: "তারিখ", key: "exam_date", className: smallCol },
      { header: "শুরু", key: "start_time", className: smallCol },
      { header: "শেষ", key: "end_time", className: smallCol },
      { header: "বিষয়", key: "subject_name", className: nameCol },
      { header: "শ্রেণি", key: "class_name", className: smallCol },
      { header: "বিভাগ", key: "division_name", className: midCol },
    ],
  },
  {
    key: "exam-candidates",
    title: "পরীক্ষার্থী তালিকা",
    subtitle: "এই পরীক্ষায় অংশগ্রহণকারী শিক্ষার্থীদের তালিকা",
    endpoint: "/reports/academic/exam-candidates",
    requiresExam: true,
    requiresDivision: true,
    columns: [
      { header: "রোল নম্বর", key: "roll", className: smallCol },
      { header: "রেজিস্ট্রেশন নম্বর", key: "registration_no", className: idCol },
      { header: "শিক্ষার্থীর নাম", key: "student_name", className: nameCol },
      { header: "পিতার নাম", key: "father_name", className: nameCol },
      { header: "শ্রেণি", key: "class_name", className: smallCol },
      { header: "বিভাগ", key: "division_name", className: midCol },
      { header: "পরীক্ষা", key: "exam_name", className: midCol },
    ],
  },
  {
    key: "exam-absentees",
    title: "অনুপস্থিত পরীক্ষার্থী তালিকা",
    subtitle: "যেসব শিক্ষার্থী কোনো বিষয়ে পরীক্ষায় অনুপস্থিত ছিল তাদের তালিকা",
    endpoint: "/reports/academic/exam-absentees",
    requiresExam: true,
    requiresDivision: true,
    columns: [
      { header: "রোল নম্বর", key: "roll", className: smallCol },
      { header: "রেজিস্ট্রেশন নম্বর", key: "registration_no", className: idCol },
      { header: "শিক্ষার্থীর নাম", key: "student_name", className: nameCol },
      { header: "শ্রেণি", key: "class_name", className: smallCol },
      { header: "বিভাগ", key: "division_name", className: midCol },
      { header: "বিষয়", key: "subject_name", className: nameCol },
      { header: "পরীক্ষা", key: "exam_name", className: midCol },
    ],
  },
];

const ExamReportPage = ({ printMode }: { printMode?: boolean }) => (
  <ReportShell
    pageTitle="পরীক্ষা রিপোর্ট"
    pageSubtitle="পরীক্ষা নির্বাচন করে স্বাক্ষরপত্র ও বিষয়ভিত্তিক নম্বরপত্র দেখুন এবং প্রিন্ট করুন।"
    accentTitle="Exam Reports"
    reports={reports}
    reportsPageKey="exam"
    printMode={printMode}
  />
);

export default ExamReportPage;
