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
  registrationNo: number;
  className: string | null;
  image: string | null;
}

export interface GuardianResultRow {
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
