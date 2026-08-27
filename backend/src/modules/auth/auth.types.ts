export interface LoginCredentials {
  email: string;
  password: string;
  madrasaId: number;
}

export interface UnlockCredentials {
  userId: number;
  madrasaId: number;
  password: string;
}

export interface AuthenticatedUserSummary {
  id: number;
  name: string;
  email: string;
  role_id: number;
  role_key: string;
  role_label: string;
  mobile?: string | null;
  photo_url?: string | null;
}

export interface LoginResult {
  token: string;
  user: AuthenticatedUserSummary;
  permissions: string[];
  modules: string[];
}

export interface MyProfile {
  id: number;
  name: string;
  email: string;
  mobile: string | null;
  photo_url: string | null;
  role_key: string;
  role_label: string;
  permissions: string[];
  modules: string[];
}

export interface UpdateMyProfileInput {
  name?: string;
  mobile?: string;
  photo_url?: string;
}
