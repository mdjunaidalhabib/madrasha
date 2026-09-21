import type { BackendDocumentType } from "./documentTypeMap";

export interface FieldBinding {
  /** Row key, e.g. "student_name" - matches the columns selected in
   * backend/src/modules/reports/reports.repository.ts exactly, so a bound
   * layer resolves correctly against both the live preview row and real
   * generated data. */
  field: string;
  label: string;
  /** True for the student/logo photo fields - only these are offered as
   * choices for photo/logo layers, everything else for text/qrcode layers. */
  isImage?: boolean;
}

const STUDENT_FIELDS: FieldBinding[] = [
  { field: "student_name", label: "শিক্ষার্থীর নাম" },
  { field: "father_name", label: "পিতার নাম" },
  { field: "mother_name", label: "মাতার নাম" },
  { field: "image", label: "শিক্ষার্থীর ছবি", isImage: true },
  { field: "roll", label: "রোল নং" },
  { field: "registration_no", label: "রেজিস্ট্রেশন নং" },
  { field: "class_name", label: "শ্রেণি" },
  { field: "division_name", label: "বিভাগ" },
  { field: "academic_year", label: "শিক্ষাবর্ষ" },
  { field: "guardian_phone", label: "অভিভাবকের মোবাইল" },
];

/** আইডি কার্ডের পিছনের পাতা - Talimat → ডকুমেন্টস টেমপ্লেট → "আইডি কার্ড ব্যাক" ট্যাবের মান (দেখুন useIdCardBackRows)। */
const ID_CARD_BACK_FIELDS: FieldBinding[] = [
  { field: "id_issue_date", label: "কার্ড ইস্যুর তারিখ" },
  { field: "id_expiry_date", label: "কার্ডের মেয়াদ শেষ" },
  { field: "principal_title", label: "অধ্যক্ষের পদবি" },
  { field: "id_lost_return", label: "হারিয়ে গেলে ফেরতের ঠিকানা" },
  { field: "principal_signature", label: "অধ্যক্ষের স্বাক্ষর", isImage: true },
];

const ADMIT_CARD_ONLY_FIELDS: FieldBinding[] = [
  { field: "exam_name", label: "পরীক্ষার নাম" },
  { field: "exam_year", label: "পরীক্ষার বছর" },
];

/** পুরস্কার বই-লেবেল - reports.repository-র prize-book-labels row + useBookLabelRows-এর তৈরি `rank_label`/`exam_label`। */
const BOOK_LABEL_FIELDS: FieldBinding[] = [
  { field: "student_name", label: "শিক্ষার্থীর নাম" },
  { field: "rank_label", label: "মেধাক্রম (১ম/২য়/৩য়...)" },
  { field: "rank_no", label: "মেধাক্রম (সংখ্যা)" },
  { field: "class_info", label: "শ্রেণি (বিভাগ) • রোল" },
  { field: "roll", label: "রোল নং" },
  { field: "class_name", label: "শ্রেণি" },
  { field: "division_name", label: "বিভাগ" },
  { field: "madrasa_grade", label: "মাদরাসা গ্রেড" },
  { field: "exam_name", label: "পরীক্ষার নাম" },
  { field: "exam_year", label: "পরীক্ষার বছর" },
  { field: "exam_label", label: "পরীক্ষা ও বছর" },
];

/** Per document type, the fields an admin can bind a layer to in the
 * PropertyInspector's field picker. Only ID_CARD/ADMIT_CARD are fully
 * accurate (matched to real SQL columns); other types get the student
 * fields as a reasonable default since most documents are student-centric,
 * and can be refined when that type gets fully wired up. */
export const FIELD_BINDINGS: Record<BackendDocumentType, FieldBinding[]> = {
  ID_CARD: [...STUDENT_FIELDS, ...ID_CARD_BACK_FIELDS],
  ADMIT_CARD: [...STUDENT_FIELDS, ...ADMIT_CARD_ONLY_FIELDS],
  CERTIFICATE: STUDENT_FIELDS,
  CLEARANCE_CERTIFICATE: STUDENT_FIELDS,
  TESTIMONIAL: STUDENT_FIELDS,
  MARKSHEET: STUDENT_FIELDS,
  FEE_RECEIPT: STUDENT_FIELDS,
  SALARY_SLIP: STUDENT_FIELDS,
  BOOK_LABEL: BOOK_LABEL_FIELDS,
};

export const getImageFieldBindings = (type: BackendDocumentType) =>
  FIELD_BINDINGS[type].filter((f) => f.isImage);

export const getTextFieldBindings = (type: BackendDocumentType) =>
  FIELD_BINDINGS[type].filter((f) => !f.isImage);
