export interface StudentAdmissionRequestDto {
  name_bn: string;
  arabic_name?: string;
  nid?: string;
  gender?: number | string;
  dob?: string;
  age?: number | string;
  division_id: number | string;
  class_id: number | string;
  academic_year: string;
  previous_class_id?: number | string;
  father_name?: string;
  father_arabic_name?: string;
  father_nid?: string;
  father_occupation?: string;
  mother_name?: string;
  mother_nid?: string;
  mother_occupation?: string;
  guardian_phone?: string;
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
