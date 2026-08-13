import api from "./api";

export interface Session {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  isActive: boolean;
}

export const sessionApi = {
  list: (activeOnly?: boolean) =>
    api.get("/sessions", { params: activeOnly ? { active_only: "true" } : {} }),
  create: (payload: { name: string; start_date: string; end_date: string; is_current?: boolean }) =>
    api.post("/sessions", payload),
  update: (id: number, payload: Record<string, unknown>) => api.put(`/sessions/${id}`, payload),
  setCurrent: (id: number) => api.patch(`/sessions/${id}/set-current`, {}),
  remove: (id: number) => api.delete(`/sessions/${id}`),
};
