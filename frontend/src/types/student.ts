/**
 * API-facing (snake_case) shape for a student row - mirrors the backend's
 * StudentApiDto (backend/src/modules/students/student.types.ts) field for
 * field. Shared by StudentListPage and BulkUpdateModal, both of which need
 * the full field set (not just the handful a given list view happens to
 * render).
 */
export interface StudentFullRecord {
  id: number;
  registration_no: number | string | null;
  name_bn: string;
  arabic_name: string | null;
  nid: string | null;
  gender: number | null;
  dob: string | null;
  age: number | null;
  blood_group: string | null;
  residency_type: number | null;
  is_orphan: number | null;
  roll: number | string | null;
  division_id: number | string | null;
  class_id: number | string | null;
  academic_year: string;
  previous_class_id: number | null;
  previous_institution: string | null;
  previous_result: string | null;
  admission_date: string | null;
  current_class: string | null;
  father_name: string | null;
  father_arabic_name: string | null;
  father_nid: string | null;
  father_occupation: string | null;
  mother_name: string | null;
  mother_nid: string | null;
  mother_occupation: string | null;
  guardian_phone: string | null;
  guardian_phone_2: string | null;
  alt_guardian_name: string | null;
  alt_guardian_relation: string | null;
  alt_guardian_address: string | null;
  alt_guardian_phone: string | null;
  division: string | null;
  district: string | null;
  thana: string | null;
  village: string | null;
  image: string | null;
  admission_status: "PENDING" | "APPROVED" | "REJECTED";
  admission_type: "NEW" | "RE_ADMISSION";
  rejection_reason: string | null;
}
