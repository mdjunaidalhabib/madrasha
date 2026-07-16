export interface TeacherPayloadDto {
  name_bn?: string;
  name_ar?: string;
  nid?: string;
  gender?: number | string;
  dob?: string;
  age?: number | string;
  phone?: string;
  email?: string;
  designation?: string;
  department?: string;
  qualification?: string;
  experience_year?: number | string;
  experience_month?: number | string;
  joining_date?: string;
  salary?: number | string;
  father_name?: string;
  father_name_ar?: string;
  father_nid?: string;
  father_occupation?: string;
  mother_name?: string;
  mother_nid?: string;
  mother_occupation?: string;
  parent_phone?: string;
  division?: string;
  district?: string;
  thana?: string;
  village?: string;
  image?: string;
  academic_division?: number | string;
  division_id?: number | string;
  academicDivision?: number | string;
  [key: string]: unknown;
}

export interface BulkTeacherRequestDto {
  teachers: TeacherPayloadDto[];
}
