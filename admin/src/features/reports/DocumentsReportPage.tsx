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
    key: "student-marksheets",
    title: "মার্কশিট",
    subtitle: "শিক্ষার্থীর ফলাফল ও মার্কশিট রিপোর্ট",
    endpoint: "/reports/student/marksheets",
    printable: "marksheet",
    documentType: "MARKSHEET",
    // Without an exam selection, a student with multiple published exams
    // would get every exam's marksheet mixed together in one print run
    // (see findStudentMarksheets's doc-comment) - require picking one.
    requiresExam: true,
    requiresDivision: true,
    columns: [
      { header: "রোল নম্বর", key: "roll" },
      { header: "রেজিস্ট্রেশন নম্বর", key: "registration_no" },
      { header: "শিক্ষার্থীর নাম", key: "student_name" },
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
  {
    key: "student-id-cards",
    title: "আইডি কার্ড",
    subtitle: "শিক্ষার্থীদের আইডি কার্ড রিপোর্ট ও প্রিন্ট",
    endpoint: "/reports/student/id-cards",
    printable: "id-card",
    documentType: "ID_CARD",
    requiresDivision: true,
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
    key: "student-id-card-backs",
    title: "আইডি কার্ড ব্যাক",
    subtitle: "আইডি কার্ডের পিছনের পাতা (ইস্যু/মেয়াদ, অধ্যক্ষের স্বাক্ষর, ফেরতের ঠিকানা) আলাদা প্রিন্ট",
    endpoint: "/reports/student/id-cards",
    printable: "id-card",
    documentType: "ID_CARD",
    backOnly: true,
    requiresDivision: true,
    columns: [
      { header: "রোল নম্বর", key: "roll" },
      { header: "রেজিস্ট্রেশন নম্বর", key: "registration_no" },
      { header: "শিক্ষার্থীর নাম", key: "student_name" },
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
    // ডিফল্ট A5 পোর্ট্রেট: উপরে-নিচে ২টি প্রবেশপত্র, মাঝে কাটার ফাঁক (স্কেল করে আঁটে)।
    defaultPaperSize: "a5",
    defaultOrientation: "portrait",
    // Admit cards are scoped to ONE exam's registered candidates (see
    // reports.repository.ts's findStudentAdmitCards) - without
    // requiresExam, the page never sent exam_id at all and the backend
    // silently defaulted to the most recent exam. Now the user must
    // explicitly pick which exam's admit cards to print.
    requiresExam: true,
    requiresDivision: true,
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
    // No requiresDivision AND no requiresExam here on purpose - this always
    // renders as exactly one static rules notice page (see
    // PaginatedReportPreview's "single" config.kind), not a per-student/
    // per-exam roster, so the fetched rows' exam scope is irrelevant to
    // what's actually rendered - forcing an exam pick first would just be
    // friction with no payload saved. See "student-admit-cards" above for
    // the actual per-candidate admit-card report, which DOES require one.
    key: "student-admit-cards-with-rules",
    title: "পরীক্ষার নিয়মাবলী",
    subtitle: "প্রবেশপত্রের সাথে দেওয়ার জন্য পরীক্ষার নিয়মাবলীর একটি মাত্র নোটিশ পৃষ্ঠা তৈরি ও প্রিন্ট",
    endpoint: "/reports/student/admit-cards",
    printable: "admit-card-with-rules",
    documentType: "ADMIT_CARD",
    // প্রবেশপত্রের সমান মাপ ও বিন্যাস: A5 পোর্ট্রেটে উপর-নিচ ২টি (A4 ল্যান্ডস্কেপে ৪টি)।
    defaultPaperSize: "a5",
    defaultOrientation: "portrait",
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
  // Custom wall-notices moved to their own "নোটিশ বোর্ড" management page
  // (talimat/settings/notices) - multiple notices can now be saved and
  // reprinted from there instead of this report list only ever holding the
  // one static custom_notice_template.
  // Custom wall-notices ("নোটিশ বোর্ড") - unlike every other card here,
  // this isn't one student's document; it's a picker over however many
  // notices have been saved (see backend/src/modules/notices). Renders
  // inline through the normal ReportContent/PaginatedReportPreview
  // pipeline just like Sanad/Testimonial, so the page's usual "প্রিন্ট"
  // button in the toolbar (DataExportPrintActions) works on it directly -
  // see NoticeBoardReportView and printableConfig's "single" kind for it.
  {
    key: "notice-board",
    title: "নোটিশ বোর্ড",
    subtitle: "দেয়ালে টানানোর নোটিশ লিখুন, সেভ রাখুন ও যেকোনোটি প্রিন্ট করুন",
    // rows are unused (see NoticeBoardReportView) - this endpoint is only
    // reused so the "single" pagination kind has something to resolve
    // against, same trick admit-card-with-rules relies on.
    endpoint: "/reports/student/admit-cards",
    printable: "notice-board",
    columns: [
      { header: "রোল নম্বর", key: "roll" },
      { header: "শিক্ষার্থীর নাম", key: "student_name" },
    ],
  },
  {
    key: "student-sanads",
    title: "সনদ / সার্টিফিকেট",
    subtitle: "শিক্ষার্থীদের শিক্ষাগত সনদ তৈরি ও প্রিন্ট",
    endpoint: "/reports/student/sanads",
    printable: "certificate",
    documentType: "CERTIFICATE",
    requiresDivision: true,
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
    requiresDivision: true,
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
    requiresDivision: true,
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
    documentType: "BOOK_LABEL",
    requiresExam: true,
    columns: PRIZE_BOOK_LABEL_COLUMNS,
  },
  {
    key: "prize-book-labels-mumtaz",
    title: "পুরস্কার বই-লেবেল (১-৩ + মুমতাজ)",
    subtitle: "নির্বাচিত পরীক্ষায় মেধাক্রম ১ম-৩য় এবং মুমতাজ গ্রেডপ্রাপ্তদের জন্য বইয়ের প্রচ্ছদ-লেবেল",
    endpoint: "/reports/academic/prize-book-labels",
    printable: "book-label",
    documentType: "BOOK_LABEL",
    requiresExam: true,
    extraParams: { mumtaz_only: "true" },
    columns: PRIZE_BOOK_LABEL_COLUMNS,
  },
];

const DocumentsReportPage = ({ printMode }: { printMode?: boolean }) => (
  <ReportShell
    reports={reports}
    reportsPageKey="documents"
    printMode={printMode}
    hideBrandHeader
    showSearch
  />
);

export default DocumentsReportPage;
