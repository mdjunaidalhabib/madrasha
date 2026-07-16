// snake_case incoming key -> Prisma (camelCase) field name
export const TEACHER_FIELD_MAP: Record<string, string> = {
  division_id: "divisionId",
  name_bn: "nameBn",
  name_ar: "nameAr",
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
  father_nid: "fatherNid",
  father_occupation: "fatherOccupation",
  mother_name: "motherName",
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
