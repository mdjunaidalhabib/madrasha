import type { BackendDocumentType } from "./documentTypeMap";
import { getText } from "../../i18n";
import { designerText } from "./designer.text";

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

/** A binding whose `label` is read in the current UI language on every
 * access (getter) - the `field` key never changes. */
const bind = (field: string, isImage?: boolean): FieldBinding => ({
  field,
  get label() {
    return getText(designerText).fields[field] ?? field;
  },
  ...(isImage ? { isImage } : {}),
});

const STUDENT_FIELDS: FieldBinding[] = [
  bind("student_name"),
  bind("father_name"),
  bind("mother_name"),
  bind("image", true),
  bind("roll"),
  bind("registration_no"),
  bind("class_name"),
  bind("division_name"),
  bind("academic_year"),
  bind("guardian_phone"),
];

/** আইডি কার্ডের পিছনের পাতা - Talimat → ডকুমেন্টস টেমপ্লেট → "আইডি কার্ড ব্যাক" ট্যাবের মান (দেখুন useIdCardBackRows)। */
const ID_CARD_BACK_FIELDS: FieldBinding[] = [
  bind("id_issue_date"),
  bind("id_expiry_date"),
  bind("principal_title"),
  bind("id_lost_return"),
  bind("principal_signature", true),
];

const ADMIT_CARD_ONLY_FIELDS: FieldBinding[] = [
  bind("exam_name"),
  bind("exam_year"),
];

/** পুরস্কার বই-লেবেল - reports.repository-র prize-book-labels row + useBookLabelRows-এর তৈরি `rank_label`/`exam_label`। */
const BOOK_LABEL_FIELDS: FieldBinding[] = [
  bind("student_name"),
  bind("rank_label"),
  bind("rank_no"),
  bind("class_info"),
  bind("roll"),
  bind("class_name"),
  bind("division_name"),
  bind("madrasa_grade"),
  bind("exam_name"),
  bind("exam_year"),
  bind("exam_label"),
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
