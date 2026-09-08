import type { AuthUser } from "../store/authStore";

/**
 * MUHTAMIM (madrasa owner/principal) and SUPER_ADMIN bypass every
 * permission check entirely on the backend (see isMuhtamimRole /
 * isSuperAdminRole short-circuits in rbac.middleware.ts) - this mirrors
 * that bypass here instead of relying on the `permissions[]` array sent at
 * login, which is intentionally incomplete for MUHTAMIM (see
 * MUHTAMIM_BASELINE_PERMISSIONS in auth.constants.ts). Without this
 * mirror, MUHTAMIM would get locked out of its own UI the moment a new
 * permission key is added to the catalog without also updating that list.
 */
const BYPASS_ROLES = new Set(["MUHTAMIM", "SUPER_ADMIN"]);

export const hasPermission = (
  user: AuthUser | null | undefined,
  permissions: string[],
  permission: string,
) => {
  const role = (user?.role || user?.role_key || "").trim().toUpperCase();
  if (BYPASS_ROLES.has(role)) return true;
  return permissions.includes(permission);
};
