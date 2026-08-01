export interface StudentAdmissionRequestDto {
  name_bn: string;
  arabic_name?: string;
  nid?: string;
  gender?: number | string;
  dob?: string;
  age?: number | string;
  blood_group?: string;
  residency_type?: number | string;
  is_orphan?: number | string | boolean;
  division_id: number | string;
  class_id: number | string;
  academic_year: string;
  previous_class_id?: number | string;
  previous_institution?: string;
  previous_result?: string;
  admission_date?: string;
  father_name?: string;
  father_arabic_name?: string;
  father_nid?: string;
  father_occupation?: string;
  mother_name?: string;
  mother_nid?: string;
  mother_occupation?: string;
  guardian_phone?: string;
  guardian_phone_2?: string;
  alt_guardian_name?: string;
  alt_guardian_relation?: string;
  alt_guardian_address?: string;
  alt_guardian_phone?: string;
  division?: string;
  district?: string;
  thana?: string;
  village?: string;
  image?: string;
  [key: string]: unknown;
}

export interface BulkAdmissionRequestDto {
  students: StudentAdmissionRequestDto[];
}

export type StudentUpdateRequestDto = Partial<StudentAdmissionRequestDto>;
