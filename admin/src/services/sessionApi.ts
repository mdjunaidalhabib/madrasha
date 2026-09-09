import api from "./api";

export interface Session {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  divisionId: number | null;
  division?: { id: number; name: string | null; nameBn: string | null } | null;
}

export const sessionApi = {
  list: (params?: { activeOnly?: boolean; divisionId?: number | null }) =>
    api.get("/sessions", {
      params: {
        ...(params?.activeOnly ? { active_only: "true" } : {}),
        ...(params?.divisionId != null ? { division_id: params.divisionId } : {}),
      },
    }),
  create: (payload: { name: string; start_date: string; end_date: string; is_active?: boolean; division_id?: number | null }) =>
    api.post("/sessions", payload),
  update: (id: number, payload: Record<string, unknown>) => api.put(`/sessions/${id}`, payload),
  setCurrent: (id: number) => api.patch(`/sessions/${id}/set-current`, {}),
  remove: (id: number) => api.delete(`/sessions/${id}`),
  removeUnusedFeeStructures: (id: number) => api.delete(`/sessions/${id}/unused-fee-structures`),
};
