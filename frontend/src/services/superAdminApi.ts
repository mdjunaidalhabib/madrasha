import api, { cachedGet } from "./adminApi";

export type MadrasaListItem = {
  id: number;
  name: string;
  slug: string;
  is_active: number;
  website_status?: string;
  plan_id?: number | null;
  plan_name?: string | null;
  student_limit?: number;
  user_limit?: number;
  address?: string | null;
  phone?: string | null;
};

/* =========================
   MADRASAS
========================= */

export async function listMadrasas(params?: { q?: string; page?: number; limit?: number }) {
  const res = await cachedGet("/super/madrasas", { params });
  return res.data;
}

export async function getMadrasa(id: number) {
  const res = await cachedGet(`/super/madrasas/${id}`);
  return res.data;
}

/* =========================
   PLANS
========================= */

export async function listPlans() {
  const res = await cachedGet("/super/plans", {
    params: { active: "1" },
  });
  return res.data;
}

export async function listPlansAdmin(params?: { q?: string; active?: "all" | "1" | "0" }) {
  const res = await cachedGet("/super/plans", { params });
  return res.data;
}

export async function listTrashPlans() {
  const res = await cachedGet("/super/plans/trash");
  return res.data;
}

export async function createPlan(payload: {
  name: string;
  student_limit: number;
  user_limit: number;
  duration_days: number;
  price: number;
  is_active?: 0 | 1;
}) {
  const res = await api.post("/super/plans", payload);
  return res.data;
}

export async function updatePlan(
  planId: number,
  payload: {
    name: string;
    student_limit: number;
    user_limit: number;
    duration_days: number;
    price: number;
    is_active?: 0 | 1;
  },
) {
  const res = await api.put(`/super/plans/${planId}`, payload);
  return res.data;
}

export async function togglePlan(planId: number) {
  const res = await api.patch(`/super/plans/${planId}/toggle`);
  return res.data;
}

export async function deletePlan(planId: number) {
  const res = await api.delete(`/super/plans/${planId}`);
  return res.data;
}

export async function restorePlan(planId: number) {
  const res = await api.post(`/super/plans/${planId}/restore`);
  return res.data;
}

export async function permanentDeletePlan(planId: number) {
  const res = await api.delete(`/super/plans/${planId}/permanent`);
  return res.data;
}

/* =========================
   ASSIGN PLAN
========================= */

export async function assignPlan(madrasaId: number, planId: number) {
  const res = await api.post(`/super/madrasas/${madrasaId}/assign-plan`, {
    plan_id: planId,
  });
  return res.data;
}

/* =========================
   ACTIVATE / SUSPEND
========================= */

export async function activateMadrasa(id: number) {
  const res = await api.post(`/super/madrasas/${id}/activate`);
  return res.data;
}

export async function suspendMadrasa(id: number) {
  const res = await api.post(`/super/madrasas/${id}/suspend`);
  return res.data;
}

/* =========================
   CREATE MADRASA
========================= */

export async function createMadrasa(payload: any) {
  const res = await api.post(`/super/madrasas`, payload);
  return res.data;
}

export async function updateMadrasa(id: number, payload: any) {
  const res = await api.put(`/super/madrasas/${id}`, payload);
  return res.data;
}

/* =========================
   MADRASA CLOUDINARY CONFIG
========================= */

export type MadrasaCloudinaryConfig = {
  configured: boolean;
  cloud_name: string | null;
  api_key: string | null;
};

export async function getMadrasaCloudinaryConfig(id: number) {
  const res = await api.get(`/super/madrasas/${id}/cloudinary`);
  return res.data.data as MadrasaCloudinaryConfig;
}

export async function saveMadrasaCloudinaryConfig(
  id: number,
  payload: { cloud_name: string; api_key: string; api_secret: string },
) {
  const res = await api.put(`/super/madrasas/${id}/cloudinary`, payload);
  return res.data;
}

export async function deleteMadrasaCloudinaryConfig(id: number) {
  const res = await api.delete(`/super/madrasas/${id}/cloudinary`);
  return res.data;
}

/* =========================
   PLATFORM SETTINGS (Super Admin's own account-level config,
   not tied to any one madrasa - e.g. the Cloudinary account System
   Template backgrounds get uploaded to)
========================= */

export type PlatformCloudinaryConfig = {
  configured: boolean;
  cloud_name: string | null;
  api_key: string | null;
};

export async function getPlatformCloudinaryConfig() {
  const res = await cachedGet("/super/platform-settings/cloudinary");
  return res.data.data as PlatformCloudinaryConfig;
}

export async function savePlatformCloudinaryConfig(payload: {
  cloud_name: string;
  api_key: string;
  api_secret: string;
}) {
  const res = await api.put("/super/platform-settings/cloudinary", payload);
  return res.data;
}

export async function deletePlatformCloudinaryConfig() {
  const res = await api.delete("/super/platform-settings/cloudinary");
  return res.data;
}

/* =========================
   TRASH MADRASAS
========================= */

export async function trashMadrasa(id: number) {
  const res = await api.delete(`/super/madrasas/${id}`);
  return res.data;
}

export async function listTrashMadrasas() {
  const res = await cachedGet(`/super/madrasas/trash`);
  return res.data;
}

export async function restoreMadrasa(id: number) {
  const res = await api.post(`/super/madrasas/${id}/restore`);
  return res.data;
}

export async function permanentDeleteMadrasa(id: number) {
  const res = await api.delete(`/super/madrasas/${id}/permanent`);
  return res.data;
}

/* =========================
   MADRASA USERS (Super Admin setup)
========================= */

export type MadrasaUserItem = {
  id: number;
  name: string;
  email: string;
  is_active: number;
  role_id: number;
  role_key: string | null;
  role_name: string | null;
  created_at?: string;
};

export type MadrasaRoleItem = {
  id: number;
  key: string | null;
  name: string | null;
};

export async function listMadrasaRoles(madrasaId: number) {
  const res = await cachedGet(`/super/madrasas/${madrasaId}/roles`);
  return res.data;
}

export async function listMadrasaUsers(madrasaId: number) {
  const res = await cachedGet(`/super/madrasas/${madrasaId}/users`);
  return res.data;
}

export async function createMadrasaUser(
  madrasaId: number,
  payload: { name: string; email: string; password: string; role_id: number },
) {
  const res = await api.post(`/super/madrasas/${madrasaId}/users`, payload);
  return res.data;
}

export async function deleteMadrasaUser(madrasaId: number, userId: number) {
  const res = await api.delete(`/super/madrasas/${madrasaId}/users/${userId}`);
  return res.data;
}
