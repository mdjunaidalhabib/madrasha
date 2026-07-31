/** Decoded JWT payload attached to `req.user` by auth.middleware / superAdmin.middleware. */
export interface AuthenticatedUser {
  id: number;
  madrasa_id: number;
  role_id: number;
  role?: string;
  role_name?: string;
  /** Absent on tenant-admin tokens. Guardian tokens set this to "guardian"
   * so auth.middleware can reject them even on routes without rbacMiddleware. */
  type?: string;
}

/** Decoded JWT payload attached to `req.guardian` by guardianAuth.middleware. */
export interface AuthenticatedGuardian {
  type: "guardian";
  guardianId: number;
  madrasaId: number;
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
