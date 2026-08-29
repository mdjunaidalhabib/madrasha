export interface LoginCredentials {
  email: string;
  password: string;
  madrasaId: number;
  /** Best-effort label (User-Agent header) stored on the issued refresh token. */
  deviceInfo?: string | null;
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
  /** Raw refresh token, valid once - the browser client should rely on the
   * httpOnly cookie set alongside this response instead of storing it. */
  refreshToken: string;
  user: AuthenticatedUserSummary;
  permissions: string[];
  modules: string[];
}

export interface RefreshTokenResult {
  token: string;
  refreshToken: string;
}

export interface ActiveSession {
  id: number;
  device_info: string | null;
  created_at: Date;
  expires_at: Date;
  is_current: boolean;
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
