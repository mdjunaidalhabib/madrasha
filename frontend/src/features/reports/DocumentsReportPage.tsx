import ReportShell, { ReportMenuItem } from "./ReportShell";

const reports: ReportMenuItem[] = [
  {
    key: "student-id-cards",
    title: "আইডি কার্ড",
    subtitle: "শিক্ষার্থীদের আইডি কার্ড রিপোর্ট ও প্রিন্ট",
    endpoint: "/reports/student/id-cards",
    printable: "id-card",
    columns: [
      { header: "রেজিস্ট্রেশন নম্বর", key: "id" },
      { header: "রোল নম্বর", key: "roll" },
      { header: "শিক্ষার্থী", key: "student_name" },
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
    columns: [
      { header: "রেজিস্ট্রেশন নম্বর", key: "id" },
      { header: "রোল নম্বর", key: "roll" },
      { header: "শিক্ষার্থী", key: "student_name" },
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
    columns: [
      { header: "রেজিস্ট্রেশন নম্বর", key: "id" },
      { header: "রোল নম্বর", key: "roll" },
      { header: "শিক্ষার্থী", key: "student_name" },
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
    columns: [
      { header: "রেজিস্ট্রেশন নম্বর", key: "id" },
      { header: "রোল নম্বর", key: "roll" },
      { header: "শিক্ষার্থী", key: "student_name" },
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
    columns: [
      { header: "রেজিস্ট্রেশন নম্বর", key: "id" },
      { header: "রোল নম্বর", key: "roll" },
      { header: "শিক্ষার্থী", key: "student_name" },
      { header: "পিতা", key: "father_name" },
      { header: "শ্রেণি", key: "class_name" },
      { header: "বিভাগ", key: "division_name" },
      { header: "সেশন", key: "academic_year" },
    ],
  },
];

const DocumentsReportPage = () => (
  <ReportShell
    pageTitle="ডকুমেন্ট সমূহ"
    pageSubtitle="আইডি কার্ড, প্রবেশপত্র, সনদ, প্রত্যয়ন পত্র ও ছাড়পত্র — database থেকে নিয়ে professional ভাবে দেখুন ও প্রিন্ট করুন।"
    accentTitle="Documents"
    reports={reports}
  />
);

export default DocumentsReportPage;
