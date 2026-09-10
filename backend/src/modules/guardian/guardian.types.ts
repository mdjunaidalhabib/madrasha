export interface GuardianLoginCredentials {
  phone: string;
  password: string;
  madrasaId: number;
}

export interface GuardianLoginResult {
  token: string;
  guardian: {
    id: number;
    name: string | null;
    phone: string;
    mustChangePassword: boolean;
  };
}

export interface GuardianChildSummary {
  id: number;
  nameBn: string;
  roll: number | null;
  registrationNo: number | null;
  className: string | null;
  image: string | null;
}

export interface GuardianResultRow {
  resultMasterId: number;
  examName: string;
  className: string;
  total: number;
  average: number;
  generalGrade: string | null;
  madrasaGrade: string | null;
  rankNo: number | null;
  roll: number | null;
}

export interface GuardianNoticeRow {
  id: number;
  title: string;
  content: string | null;
  publishedAt: Date | null;
}

export interface GuardianExamRoutineRow {
  id: number;
  examName: string;
  examYear: string;
  className: string;
  subject: string;
  examDate: Date;
  startTime: string;
  endTime: string;
  roomNo: string | null;
}

export interface GuardianMarksheetSubjectRow {
  bookId: number;
  subjectName: string;
  mark: number | null;
  isAbsent: boolean;
  fullMarks: number | null;
}

export interface GuardianMarksheetDetail {
  examName: string;
  examYear: string;
  className: string;
  studentName: string;
  roll: number | null;
  registrationNo: number | null;
  fatherName: string | null;
  dob: Date | null;
  total: number;
  average: number;
  generalGrade: string | null;
  madrasaGrade: string | null;
  status: string | null;
  rankNo: number | null;
  subjects: GuardianMarksheetSubjectRow[];
}
