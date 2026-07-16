import api from "./adminApi";

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
  const res = await api.get("/super/madrasas", { params });
  return res.data;
}

/* =========================
   PLANS
========================= */

export async function listPlans() {
  const res = await api.get("/super/plans", {
    params: { active: "1" },
  });
  return res.data;
}

export async function listPlansAdmin(params?: { q?: string; active?: "all" | "1" | "0" }) {
  const res = await api.get("/super/plans", { params });
  return res.data;
}

export async function listTrashPlans() {
  const res = await api.get("/super/plans/trash");
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
   TRASH MADRASAS
========================= */

export async function trashMadrasa(id: number) {
  const res = await api.delete(`/super/madrasas/${id}`);
  return res.data;
}

export async function listTrashMadrasas() {
  const res = await api.get(`/super/madrasas/trash`);
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
