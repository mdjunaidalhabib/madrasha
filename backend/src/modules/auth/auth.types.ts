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
}

export interface LoginResult {
  token: string;
  user: AuthenticatedUserSummary;
  permissions: string[];
  modules: string[];
}
