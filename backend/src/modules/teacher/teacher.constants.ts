// snake_case incoming key -> Prisma (camelCase) field name
export const TEACHER_FIELD_MAP: Record<string, string> = {
  division_id: "divisionId",
  name_bn: "nameBn",
  name_ar: "nameAr",
  name_en: "nameEn",
  nid: "nid",
  gender: "gender",
  dob: "dob",
  age: "age",
  phone: "phone",
  email: "email",
  designation: "designation",
  department: "department",
  qualification: "qualification",
  experience_year: "experienceYear",
  experience_month: "experienceMonth",
  joining_date: "joiningDate",
  salary: "salary",
  father_name: "fatherName",
  father_name_ar: "fatherNameAr",
  father_name_en: "fatherNameEn",
  father_nid: "fatherNid",
  father_occupation: "fatherOccupation",
  mother_name: "motherName",
  mother_name_ar: "motherNameAr",
  mother_name_en: "motherNameEn",
  mother_nid: "motherNid",
  mother_occupation: "motherOccupation",
  parent_phone: "parentPhone",
  division: "division",
  district: "district",
  thana: "thana",
  village: "village",
  image: "image",
};

export const TEACHER_DATE_FIELDS = new Set(["dob", "joining_date"]);

export const TEACHER_NUMBER_FIELDS = new Set([
  "age",
  "salary",
  "experience_year",
  "experience_month",
  "division_id",
  "gender",
]);

// Bulk-update (Excel round-trip on existing teachers) excludes `image`
// (binary data isn't round-trippable via Excel). Unlike students, teachers
// have no Promotion-equivalent audit-trailed workflow, so division_id stays
// editable here - existence is re-checked against the tenant's activated
// divisions inside the transaction (see findDivisionIdsForTenantOnTx).
export const TEACHER_BULK_UPDATE_EXCLUDED_FIELDS = ["image"] as const;

export const TEACHER_BULK_UPDATE_FIELD_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(TEACHER_FIELD_MAP).filter(
    ([key]) => !(TEACHER_BULK_UPDATE_EXCLUDED_FIELDS as readonly string[]).includes(key),
  ),
);
