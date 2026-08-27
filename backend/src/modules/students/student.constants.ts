export const STUDENT_REQUIRED_FIELDS = [
  "name_bn",
  "division_id",
  "class_id",
  "academic_year",
] as const;

// snake_case incoming key -> Prisma (camelCase) field name
export const STUDENT_FIELD_MAP: Record<string, string> = {
  name_bn: "nameBn",
  arabic_name: "arabicName",
  name_en: "nameEn",
  nid: "nid",
  gender: "gender",
  dob: "dob",
  age: "age",
  blood_group: "bloodGroup",
  residency_type: "residencyType",
  is_orphan: "isOrphan",
  division_id: "divisionId",
  class_id: "classId",
  academic_year: "academicYear",
  previous_class_id: "previousClassId",
  previous_institution: "previousInstitution",
  previous_result: "previousResult",
  admission_date: "admissionDate",
  father_name: "fatherName",
  father_arabic_name: "fatherArabicName",
  father_name_en: "fatherNameEn",
  father_nid: "fatherNid",
  father_occupation: "fatherOccupation",
  mother_name: "motherName",
  mother_arabic_name: "motherArabicName",
  mother_name_en: "motherNameEn",
  mother_nid: "motherNid",
  mother_occupation: "motherOccupation",
  guardian_phone: "guardianPhone",
  guardian_phone_2: "guardianPhone2",
  alt_guardian_name: "altGuardianName",
  alt_guardian_arabic_name: "altGuardianArabicName",
  alt_guardian_name_en: "altGuardianNameEn",
  alt_guardian_relation: "altGuardianRelation",
  alt_guardian_address: "altGuardianAddress",
  alt_guardian_phone: "altGuardianPhone",
  division: "division",
  district: "district",
  thana: "thana",
  village: "village",
  image: "image",
};

export const STUDENT_NUMERIC_FIELDS = [
  "age",
  "division_id",
  "class_id",
  "previous_class_id",
  "residency_type",
  "is_orphan",
] as const;

// Bulk-update (Excel round-trip on existing students) must never touch class/
// division/academic_year/roll - those stay locked and can only be changed
// through the dedicated প্রমোশন feature, which keeps its own audit trail.
// `image` is excluded too since binary data isn't round-trippable via Excel.
export const STUDENT_BULK_UPDATE_EXCLUDED_FIELDS = [
  "class_id",
  "division_id",
  "academic_year",
  "roll",
  "image",
] as const;

export const STUDENT_BULK_UPDATE_FIELD_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(STUDENT_FIELD_MAP).filter(
    ([key]) => !(STUDENT_BULK_UPDATE_EXCLUDED_FIELDS as readonly string[]).includes(key),
  ),
);
