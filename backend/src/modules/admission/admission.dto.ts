export interface AdmissionRequestDto {
  name: string;
  nid: string;
  division_id: number | string;
  class_id: number | string;
  academic_year: string;
  previous_class_id?: number | string;
  arabicName?: string;
  gender?: string;
  dob?: string;
  age?: number | string;
  fatherName?: string;
  fatherArabicName?: string;
  fatherNid?: string;
  fatherOccupation?: string;
  motherName?: string;
  motherNid?: string;
  motherOccupation?: string;
  parentPhone?: string;
  division?: string;
  district?: string;
  thana?: string;
  village?: string;
  image?: string;
}
