import ReportShell, { ReportMenuItem } from "./ReportShell";
import { useLocalizedReports, type ReportBuilder } from "./useLocalizedReports";
import type { ReportText } from "../../components/Report/report.text";

const prizeBookLabelColumns = (col: ReportText["col"]) => [
  { header: col.rank, key: "rank_no" },
  { header: col.studentName, key: "student_name" },
  { header: col.roll, key: "roll" },
  { header: col.class, key: "class_name" },
  { header: col.division, key: "division_name" },
  { header: col.grade, key: "madrasa_grade" },
  { header: col.exam, key: "exam_name" },
  { header: col.sessionShort, key: "exam_year" },
];

const buildReports: ReportBuilder = (t, col, isMadrasa): ReportMenuItem[] => [
  {
    key: "student-marksheets",
    ...t.r["student-marksheets"],
    endpoint: "/reports/student/marksheets",
    printable: "marksheet",
    documentType: "MARKSHEET",
    // Without an exam selection, a student with multiple published exams
    // would get every exam's marksheet mixed together in one print run
    // (see findStudentMarksheets's doc-comment) - require picking one.
    requiresExam: true,
    requiresDivision: true,
    columns: [
      { header: col.rollNo, key: "roll" },
      { header: col.regNoFull, key: "registration_no" },
      { header: col.studentName, key: "student_name" },
      { header: col.exam, key: "exam_name" },
      { header: col.class, key: "class_name" },
      { header: col.total, key: "total" },
      { header: col.average, key: "average" },
      { header: col.grade, key: "general_grade" },
      // মাদরাসা গ্রেড (মুমতাজ...) কলাম শুধু মাদরাসায় দেখানো হয় - ডাটা যেমন ছিল তেমনই।
      ...(isMadrasa ? [{ header: col.madrasaGrade, key: "madrasa_grade" }] : []),
      { header: col.rank, key: "rank_no" },
      { header: col.status, key: "status" },
    ],
  },
  {
    key: "student-id-cards",
    ...t.r["student-id-cards"],
    endpoint: "/reports/student/id-cards",
    printable: "id-card",
    documentType: "ID_CARD",
    requiresDivision: true,
    columns: [
      { header: col.rollNo, key: "roll" },
      { header: col.regNoFull, key: "registration_no" },
      { header: col.studentName, key: "student_name" },
      { header: col.father, key: "father_name" },
      { header: col.class, key: "class_name" },
      { header: col.division, key: "division_name" },
      { header: col.mobile, key: "guardian_phone" },
    ],
  },
  {
    key: "student-id-card-backs",
    ...t.r["student-id-card-backs"],
    endpoint: "/reports/student/id-cards",
    printable: "id-card",
    documentType: "ID_CARD",
    backOnly: true,
    requiresDivision: true,
    columns: [
      { header: col.rollNo, key: "roll" },
      { header: col.regNoFull, key: "registration_no" },
      { header: col.studentName, key: "student_name" },
      { header: col.class, key: "class_name" },
      { header: col.division, key: "division_name" },
      { header: col.mobile, key: "guardian_phone" },
    ],
  },
  {
    key: "student-admit-cards",
    ...t.r["student-admit-cards"],
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
      { header: col.rollNo, key: "roll" },
      { header: col.regNoFull, key: "registration_no" },
      { header: col.studentName, key: "student_name" },
      { header: col.class, key: "class_name" },
      { header: col.division, key: "division_name" },
      { header: col.exam, key: "exam_name" },
      { header: col.sessionShort, key: "academic_year" },
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
    ...t.r["student-admit-cards-with-rules"],
    endpoint: "/reports/student/admit-cards",
    printable: "admit-card-with-rules",
    documentType: "ADMIT_CARD",
    // প্রবেশপত্রের সমান মাপ ও বিন্যাস: A5 পোর্ট্রেটে উপর-নিচ ২টি (A4 ল্যান্ডস্কেপে ৪টি)।
    defaultPaperSize: "a5",
    defaultOrientation: "portrait",
    columns: [
      { header: col.rollNo, key: "roll" },
      { header: col.regNoFull, key: "registration_no" },
      { header: col.studentName, key: "student_name" },
      { header: col.class, key: "class_name" },
      { header: col.division, key: "division_name" },
      { header: col.exam, key: "exam_name" },
      { header: col.sessionShort, key: "academic_year" },
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
    ...t.r["notice-board"],
    // rows are unused (see NoticeBoardReportView) - this endpoint is only
    // reused so the "single" pagination kind has something to resolve
    // against, same trick admit-card-with-rules relies on.
    endpoint: "/reports/student/admit-cards",
    printable: "notice-board",
    columns: [
      { header: col.rollNo, key: "roll" },
      { header: col.studentName, key: "student_name" },
    ],
  },
  {
    key: "student-sanads",
    // "সনদ" শব্দ শুধু মাদরাসার জন্য; অন্য প্রতিষ্ঠানে সার্টিফিকেট।
    ...(isMadrasa ? t.r["student-sanads"] : t.r["student-certificates"]),
    endpoint: "/reports/student/sanads",
    printable: "certificate",
    documentType: "CERTIFICATE",
    requiresDivision: true,
    columns: [
      { header: col.rollNo, key: "roll" },
      { header: col.regNoFull, key: "registration_no" },
      { header: col.studentName, key: "student_name" },
      { header: col.father, key: "father_name" },
      { header: col.mother, key: "mother_name" },
      { header: col.class, key: "class_name" },
      { header: col.division, key: "division_name" },
      { header: col.sessionShort, key: "academic_year" },
    ],
  },
  {
    key: "student-testimonials",
    ...t.r["student-testimonials"],
    endpoint: "/reports/student/certificates",
    printable: "testimonial",
    documentType: "TESTIMONIAL",
    requiresDivision: true,
    columns: [
      { header: col.rollNo, key: "roll" },
      { header: col.regNoFull, key: "registration_no" },
      { header: col.studentName, key: "student_name" },
      { header: col.father, key: "father_name" },
      { header: col.mother, key: "mother_name" },
      { header: col.class, key: "class_name" },
      { header: col.division, key: "division_name" },
      { header: col.mobile, key: "guardian_phone" },
    ],
  },
  {
    key: "student-transfer-letters",
    ...t.r["student-transfer-letters"],
    endpoint: "/reports/student/transfer-letters",
    printable: "transfer-letter",
    documentType: "CLEARANCE_CERTIFICATE",
    requiresDivision: true,
    columns: [
      { header: col.rollNo, key: "roll" },
      { header: col.regNoFull, key: "registration_no" },
      { header: col.studentName, key: "student_name" },
      { header: col.father, key: "father_name" },
      { header: col.class, key: "class_name" },
      { header: col.division, key: "division_name" },
      { header: col.sessionShort, key: "academic_year" },
    ],
  },
  {
    key: "prize-book-labels-rank",
    ...t.r["prize-book-labels-rank"],
    endpoint: "/reports/academic/prize-book-labels",
    printable: "book-label",
    documentType: "BOOK_LABEL",
    requiresExam: true,
    columns: prizeBookLabelColumns(col),
  },
  // মুমতাজ (মাদরাসা গ্রেড) ভিত্তিক বই-লেবেল শুধু মাদরাসায় দেখানো হয়।
  ...(isMadrasa
    ? [
        {
          key: "prize-book-labels-mumtaz",
          ...t.r["prize-book-labels-mumtaz"],
          endpoint: "/reports/academic/prize-book-labels",
          printable: "book-label" as const,
          documentType: "BOOK_LABEL" as const,
          requiresExam: true,
          extraParams: { mumtaz_only: "true" },
          columns: prizeBookLabelColumns(col),
        },
      ]
    : []),
];

const DocumentsReportPage = ({ printMode }: { printMode?: boolean }) => {
  const { reports, printReports } = useLocalizedReports(buildReports);
  return (
    <ReportShell
      reports={reports}
      printReports={printReports}
      reportsPageKey="documents"
      printMode={printMode}
      hideBrandHeader
      showSearch
    />
  );
};

export default DocumentsReportPage;
