export const STUDENT_REQUIRED_FIELDS = ["name_bn", "division_id", "class_id", "academic_year"] as const;

// snake_case incoming key -> Prisma (camelCase) field name
export const STUDENT_FIELD_MAP: Record<string, string> = {
  name_bn: "nameBn",
  arabic_name: "arabicName",
  nid: "nid",
  gender: "gender",
  dob: "dob",
  age: "age",
  division_id: "divisionId",
  class_id: "classId",
  academic_year: "academicYear",
  previous_class_id: "previousClassId",
  father_name: "fatherName",
  father_arabic_name: "fatherArabicName",
  father_nid: "fatherNid",
  father_occupation: "fatherOccupation",
  mother_name: "motherName",
  mother_nid: "motherNid",
  mother_occupation: "motherOccupation",
  guardian_phone: "guardianPhone",
  division: "division",
  district: "district",
  thana: "thana",
  village: "village",
  image: "image",
};

export const STUDENT_NUMERIC_FIELDS = ["age", "division_id", "class_id", "previous_class_id"] as const;
