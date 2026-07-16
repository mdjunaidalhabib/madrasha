/** Decoded JWT payload attached to `req.user` by auth.middleware / superAdmin.middleware. */
export interface AuthenticatedUser {
  id: number;
  madrasa_id: number;
  role_id: number;
  role?: string;
  role_name?: string;
}

/** Resolved tenant (madrasa) attached to `req.tenant` by tenant.middleware. */
export interface TenantContext {
  madrasa_id: number;
  slug: string;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface ApiSuccessResponse<T> {
  success: true;
  message?: string;
  data?: T;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: unknown;
}
