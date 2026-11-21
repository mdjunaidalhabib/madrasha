export interface AdmissionFormData {
  name: string;
  arabicName: string;
  nameEn: string;
  nid: string;
  gender: number | null;
  dob: string;
  age: number | null;
  bloodGroup: string;
  residencyType: number | null;
  isOrphan: boolean;
  roll: string;
  admissionDate: string;
  academicYear: string;
  academicDivision: string;
  previousClass: string;
  previousInstitution: string;
  previousResult: string;
  currentClass: string;
  fatherName: string;
  fatherArabicName: string;
  fatherNameEn: string;
  fatherNid: string;
  fatherOccupation: string;
  motherName: string;
  motherArabicName: string;
  motherNameEn: string;
  motherNid: string;
  motherOccupation: string;
  parentPhone: string;
  parentPhone2: string;
  hasAltGuardian: boolean;
  altGuardianName: string;
  altGuardianArabicName: string;
  altGuardianNameEn: string;
  altGuardianRelation: string;
  altGuardianAddress: string;
  altGuardianPhone: string;
  division: string;
  district: string;
  thana: string;
  village: string;
  image: string;
}

export type AdmissionFormErrors = Partial<Record<keyof AdmissionFormData, string>>;

