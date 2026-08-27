// snake_case incoming key -> Prisma (camelCase) field name
export const STAFF_FIELD_MAP: Record<string, string> = {
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

export const STAFF_DATE_FIELDS = new Set(["dob", "joining_date"]);

export const STAFF_NUMBER_FIELDS = new Set(["age", "salary", "experience_year", "experience_month", "gender"]);
