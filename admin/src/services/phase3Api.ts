import api from "./api";

/**
 * Phase 3 API bindings: Role & Permission management + Users
 * (staff account) management. Thin wrappers only, same pattern as
 * phase1Api.ts / phase2Api.ts.
 */

export interface PermissionCatalogItem {
  id: number;
  keyName: string;
  name: string;
}

export interface RoleItem {
  id: number;
  key_name: string | null;
  name_bn: string | null;
  is_protected: boolean;
  user_count: number;
  permission_keys: string[];
}

export const roleApi = {
  list: () => api.get("/roles"),
  listPermissions: () => api.get("/permissions"),
  create: (payload: { name_bn: string; permission_keys?: string[] }) =>
    api.post("/roles", payload),
  update: (id: number, payload: { name_bn?: string; permission_keys?: string[] }) =>
    api.put(`/roles/${id}`, payload),
  remove: (id: number) => api.delete(`/roles/${id}`),
};

export interface UserItem {
  id: number;
  name: string;
  email: string;
  mobile: string | null;
  photoUrl: string | null;
  roleId: number;
  isActive: number;
  roleKey: string | null;
  isMuhtamim: boolean;
  lastLoginAt: string | null;
  lockedUntil: string | null;
}

export const userAdminApi = {
  list: () => api.get("/users"),
  create: (payload: { name: string; email: string; password: string; role_id: number }) =>
    api.post("/users", payload),
  update: (
    id: number,
    payload: { role_id?: number; is_active?: boolean; name?: string; mobile?: string; photo_url?: string },
  ) => api.patch(`/users/${id}`, payload),
  resetPassword: (id: number, password: string) => api.post(`/users/${id}/reset-password`, { password }),
  unlock: (id: number) => api.post(`/users/${id}/unlock`, {}),
  remove: (id: number) => api.delete(`/users/${id}`),
};
