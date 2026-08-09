import api, { cachedGet } from "./adminApi";

// Global (platform-wide, not per-tenant) academic catalog — Division/Class/
// Book — plus the Default Fee Structure templates copied into a new
// madrasa's own fee structures at creation time. See backend
// meta.*.ts / default-fee-structure.*.ts (mounted under /super).

export interface CatalogDivisionDto {
  id: number;
  key_name: string | null;
  name: string | null;
  label: string | null;
}

export interface CatalogClassDto {
  id: number;
  name: string | null;
  label: string | null;
  division_id: number | null;
  is_active: boolean;
}

export interface CatalogBookDto {
  id: number;
  name: string | null;
  label: string | null;
  class_id: number | null;
}

export type DefaultFeeFrequency = "ONE_TIME" | "MONTHLY" | "YEARLY";

export interface DefaultFeeStructureDto {
  id: number;
  class_id: number | null;
  class_label: string | null;
  name: string;
  amount: string | number;
  frequency: DefaultFeeFrequency;
  is_active: boolean;
}

/* ================= DIVISIONS ================= */

export const catalogDivisionApi = {
  list: () => cachedGet<{ data: CatalogDivisionDto[] }>("/super/divisions"),
  create: (payload: { name_bn: string }) => api.post("/super/divisions", payload),
  update: (id: number, payload: { name_bn: string }) => api.put(`/super/divisions/${id}`, payload),
  remove: (id: number) => api.delete(`/super/divisions/${id}`),
  reorder: (divisionIds: number[]) => api.put("/super/divisions/reorder", { division_ids: divisionIds }),
};

/* ================= CLASSES ================= */

export const catalogClassApi = {
  list: (divisionId?: number, includeInactive = true) =>
    cachedGet<{ data: CatalogClassDto[] }>("/super/classes", {
      params: { division_id: divisionId, include_inactive: includeInactive ? "true" : undefined },
    }),
  create: (payload: { division_id: number; name_bn: string }) => api.post("/super/classes", payload),
  update: (id: number, payload: { name_bn: string }) => api.put(`/super/classes/${id}`, payload),
  toggleActive: (id: number, isActive: boolean) =>
    api.patch(`/super/classes/${id}/toggle`, { is_active: isActive }),
  remove: (id: number) => api.delete(`/super/classes/${id}`),
  reorder: (divisionId: number, classIds: number[]) =>
    api.put("/super/classes/reorder", { division_id: divisionId, class_ids: classIds }),
};

/* ================= BOOKS ================= */

export const catalogBookApi = {
  list: (classId?: number) => cachedGet<{ data: CatalogBookDto[] }>("/super/books", { params: { class_id: classId } }),
  create: (payload: { class_id: number; name_bn: string }) => api.post("/super/books", payload),
  update: (id: number, payload: { name_bn: string }) => api.put(`/super/books/${id}`, payload),
  remove: (id: number) => api.delete(`/super/books/${id}`),
  reorder: (classId: number, bookIds: number[]) => api.put("/super/books/reorder", { class_id: classId, book_ids: bookIds }),
};

/* ================= DEFAULT FEE STRUCTURE TEMPLATES ================= */

export const defaultFeeStructureApi = {
  list: (classId?: number) =>
    cachedGet<{ data: DefaultFeeStructureDto[] }>("/super/default-fee-structures", {
      params: { class_id: classId },
    }),
  create: (payload: { class_id?: number | null; name: string; amount: number; frequency: DefaultFeeFrequency }) =>
    api.post("/super/default-fee-structures", payload),
  update: (
    id: number,
    payload: Partial<{ class_id: number | null; name: string; amount: number; frequency: DefaultFeeFrequency; is_active: boolean }>,
  ) => api.put(`/super/default-fee-structures/${id}`, payload),
  remove: (id: number) => api.delete(`/super/default-fee-structures/${id}`),
};
