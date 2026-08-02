/**
 * API-facing (snake_case) shape for a teacher row - mirrors the backend's
 * toTeacherApiDto output (backend/src/modules/teacher/teacher.mapper.ts)
 * field for field. Shared by TeacherListPage and its BulkUpdateModal, both
 * of which need the full field set.
 */
export interface TeacherFullRecord {
  id: number;
  registration_no: number | string | null;
  name_bn: string;
  name_ar: string | null;
  nid: string | null;
  gender: number | null;
  dob: string | null;
  age: number | null;
  division_id: number | string | null;
  academic_division: number | string | null;
  academic_division_name: string | null;
  phone: string | null;
  email: string | null;
  designation: string | null;
  department: string | null;
  qualification: string | null;
  experience_year: number | null;
  experience_month: number | null;
  joining_date: string | null;
  salary: number | string | null;
  father_name: string | null;
  father_name_ar: string | null;
  father_nid: string | null;
  father_occupation: string | null;
  mother_name: string | null;
  mother_nid: string | null;
  mother_occupation: string | null;
  parent_phone: string | null;
  division: string | null;
  district: string | null;
  thana: string | null;
  village: string | null;
  image: string | null;
}
