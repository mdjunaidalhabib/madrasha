import ReportShell, { ReportMenuItem } from "./ReportShell";

const PRIZE_BOOK_LABEL_COLUMNS = [
  { header: "মেধাক্রম", key: "rank_no" },
  { header: "শিক্ষার্থীর নাম", key: "student_name" },
  { header: "রোল", key: "roll" },
  { header: "শ্রেণি", key: "class_name" },
  { header: "বিভাগ", key: "division_name" },
  { header: "গ্রেড", key: "madrasa_grade" },
  { header: "পরীক্ষা", key: "exam_name" },
  { header: "সেশন", key: "exam_year" },
];

const reports: ReportMenuItem[] = [
  {
    key: "student-id-cards",
    title: "আইডি কার্ড",
    subtitle: "শিক্ষার্থীদের আইডি কার্ড রিপোর্ট ও প্রিন্ট",
    endpoint: "/reports/student/id-cards",
    printable: "id-card",
    documentType: "ID_CARD",
    columns: [
      { header: "রোল নম্বর", key: "roll" },
      { header: "রেজিস্ট্রেশন নম্বর", key: "registration_no" },
      { header: "শিক্ষার্থীর নাম", key: "student_name" },
      { header: "পিতা", key: "father_name" },
      { header: "শ্রেণি", key: "class_name" },
      { header: "বিভাগ", key: "division_name" },
      { header: "মোবাইল", key: "guardian_phone" },
    ],
  },
  {
    key: "student-admit-cards",
    title: "প্রবেশপত্র",
    subtitle: "শিক্ষার্থীদের পরীক্ষার প্রবেশপত্র তৈরি ও প্রিন্ট",
    endpoint: "/reports/student/admit-cards",
    printable: "admit-card",
    documentType: "ADMIT_CARD",
    columns: [
      { header: "রোল নম্বর", key: "roll" },
      { header: "রেজিস্ট্রেশন নম্বর", key: "registration_no" },
      { header: "শিক্ষার্থীর নাম", key: "student_name" },
      { header: "শ্রেণি", key: "class_name" },
      { header: "বিভাগ", key: "division_name" },
      { header: "পরীক্ষা", key: "exam_name" },
      { header: "সেশন", key: "academic_year" },
    ],
  },
  {
    key: "student-admit-cards-with-rules",
    title: "পরীক্ষার নিয়মাবলী",
    subtitle: "প্রবেশপত্রের সাথে দেওয়ার জন্য পরীক্ষার নিয়মাবলীর একটি মাত্র নোটিশ পৃষ্ঠা তৈরি ও প্রিন্ট",
    endpoint: "/reports/student/admit-cards",
    printable: "admit-card-with-rules",
    documentType: "ADMIT_CARD",
    columns: [
      { header: "রোল নম্বর", key: "roll" },
      { header: "রেজিস্ট্রেশন নম্বর", key: "registration_no" },
      { header: "শিক্ষার্থীর নাম", key: "student_name" },
      { header: "শ্রেণি", key: "class_name" },
      { header: "বিভাগ", key: "division_name" },
      { header: "পরীক্ষা", key: "exam_name" },
      { header: "সেশন", key: "academic_year" },
    ],
  },
  {
    key: "student-sanads",
    title: "সনদ / সার্টিফিকেট",
    subtitle: "শিক্ষার্থীদের শিক্ষাগত সনদ তৈরি ও প্রিন্ট",
    endpoint: "/reports/student/sanads",
    printable: "certificate",
    documentType: "CERTIFICATE",
    columns: [
      { header: "রোল নম্বর", key: "roll" },
      { header: "রেজিস্ট্রেশন নম্বর", key: "registration_no" },
      { header: "শিক্ষার্থীর নাম", key: "student_name" },
      { header: "পিতা", key: "father_name" },
      { header: "মাতা", key: "mother_name" },
      { header: "শ্রেণি", key: "class_name" },
      { header: "বিভাগ", key: "division_name" },
      { header: "সেশন", key: "academic_year" },
    ],
  },
  {
    key: "student-testimonials",
    title: "প্রত্যয়ন পত্র",
    subtitle: "শিক্ষার্থীদের প্রত্যয়ন পত্র তৈরি ও প্রিন্ট",
    endpoint: "/reports/student/certificates",
    printable: "testimonial",
    documentType: "TESTIMONIAL",
    columns: [
      { header: "রোল নম্বর", key: "roll" },
      { header: "রেজিস্ট্রেশন নম্বর", key: "registration_no" },
      { header: "শিক্ষার্থীর নাম", key: "student_name" },
      { header: "পিতা", key: "father_name" },
      { header: "মাতা", key: "mother_name" },
      { header: "শ্রেণি", key: "class_name" },
      { header: "বিভাগ", key: "division_name" },
      { header: "মোবাইল", key: "guardian_phone" },
    ],
  },
  {
    key: "student-transfer-letters",
    title: "ছাড়পত্র",
    subtitle: "শিক্ষার্থীদের ছাড়পত্র তৈরি ও প্রিন্ট",
    endpoint: "/reports/student/transfer-letters",
    printable: "transfer-letter",
    documentType: "CLEARANCE_CERTIFICATE",
    columns: [
      { header: "রোল নম্বর", key: "roll" },
      { header: "রেজিস্ট্রেশন নম্বর", key: "registration_no" },
      { header: "শিক্ষার্থীর নাম", key: "student_name" },
      { header: "পিতা", key: "father_name" },
      { header: "শ্রেণি", key: "class_name" },
      { header: "বিভাগ", key: "division_name" },
      { header: "সেশন", key: "academic_year" },
    ],
  },
  {
    key: "prize-book-labels-rank",
    title: "পুরস্কার বই-লেবেল (মেধাক্রম ১-৩)",
    subtitle: "নির্বাচিত পরীক্ষায় ১ম, ২য়, ৩য় স্থান অধিকারীদের জন্য বইয়ের প্রচ্ছদ-লেবেল",
    endpoint: "/reports/academic/prize-book-labels",
    printable: "book-label",
    requiresExam: true,
    columns: PRIZE_BOOK_LABEL_COLUMNS,
  },
  {
    key: "prize-book-labels-mumtaz",
    title: "পুরস্কার বই-লেবেল (১-৩ + মুমতাজ)",
    subtitle: "নির্বাচিত পরীক্ষায় মেধাক্রম ১ম-৩য় এবং মুমতাজ গ্রেডপ্রাপ্তদের জন্য বইয়ের প্রচ্ছদ-লেবেল",
    endpoint: "/reports/academic/prize-book-labels",
    printable: "book-label",
    requiresExam: true,
    extraParams: { mumtaz_only: "true" },
    columns: PRIZE_BOOK_LABEL_COLUMNS,
  },
];

const DocumentsReportPage = () => (
  <ReportShell
    pageTitle="ডকুমেন্ট সমূহ"
    pageSubtitle="আইডি কার্ড, প্রবেশপত্র, সনদ, প্রত্যয়ন পত্র, ছাড়পত্র ও পুরস্কার বই-লেবেল — database থেকে নিয়ে professional ভাবে দেখুন ও প্রিন্ট করুন।"
    accentTitle="Documents"
    reports={reports}
    hideBrandHeader
  />
);

export default DocumentsReportPage;
