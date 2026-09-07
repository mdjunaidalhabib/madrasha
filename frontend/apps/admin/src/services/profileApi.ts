import api from "./api";

export type MyProfile = {
  id: number;
  name: string;
  email: string;
  mobile: string | null;
  photo_url: string | null;
  role_key: string;
  role_label: string;
  permissions: string[];
  modules: string[];
};

export type UpdateMyProfilePayload = {
  name?: string;
  mobile?: string;
  photo_url?: string;
};

export type ActiveSession = {
  id: number;
  device_info: string | null;
  created_at: string;
  expires_at: string;
  is_current: boolean;
};

export async function getMyProfile(): Promise<MyProfile> {
  const res = await api.get("/auth/me");
  return res.data;
}

export async function updateMyProfile(payload: UpdateMyProfilePayload) {
  const res = await api.patch("/auth/me", payload);
  return res.data;
}

export async function changeMyPassword(current_password: string, new_password: string) {
  const res = await api.post("/auth/change-password", { current_password, new_password });
  return res.data;
}

/** Revokes just this browser's refresh-token session server-side, best
 * effort - the caller still clears local auth state regardless. */
export async function logoutSession() {
  try {
    await api.post("/auth/logout");
  } catch {
    // ignore - local logout must proceed either way
  }
}

/** Logs out every session. Pass `keepCurrent: true` for "logout from OTHER
 * devices only" - this browser stays signed in; omitted/false also signs
 * this browser out. */
export async function logoutAllDevices(keepCurrent = false) {
  const res = await api.post("/auth/logout-all", { keep_current: keepCurrent });
  return res.data;
}

/** Revokes one specific session (from the device list on the profile page). */
export async function revokeSession(id: number) {
  const res = await api.delete(`/auth/sessions/${id}`);
  return res.data;
}

/** Lists this user's still-valid sessions/devices - shown on the profile
 * page so the user can see (and individually end) what's signed in. */
export async function getActiveSessions(): Promise<ActiveSession[]> {
  const res = await api.get("/auth/sessions");
  return res.data?.sessions || [];
}
