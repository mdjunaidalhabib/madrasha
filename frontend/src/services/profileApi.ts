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
