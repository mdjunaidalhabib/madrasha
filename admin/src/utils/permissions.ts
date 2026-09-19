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

/**
 * তালিমাত is the head of the exam department and acts as its super admin:
 * every exam/marks/result/routine permission (plus exam/academic reports) is
 * implied by the role. Mirrors roleImpliesPermission in the backend's
 * rbac-policy.ts - keep the two lists identical. Everything outside the exam
 * department (accounts, fee, users, ...) still needs an explicit grant.
 */
const EXAM_DEPARTMENT_PERMISSION_PREFIXES = ["exam.", "marks.", "result.", "routine."];
const EXAM_DEPARTMENT_REPORT_PERMISSIONS = new Set(["reports.exam", "reports.academic"]);

const isExamDepartmentPermission = (permission: string) =>
  EXAM_DEPARTMENT_PERMISSION_PREFIXES.some((prefix) => permission.startsWith(prefix)) ||
  EXAM_DEPARTMENT_REPORT_PERMISSIONS.has(permission);

export const hasPermission = (
  user: AuthUser | null | undefined,
  permissions: string[],
  permission: string,
) => {
  const rawRole = (user?.role || user?.role_key || "").trim();
  const role = rawRole.toUpperCase();
  if (BYPASS_ROLES.has(role)) return true;
  if ((role === "TALIMAT" || rawRole === "তালিমাত") && isExamDepartmentPermission(permission)) return true;
  return permissions.includes(permission);
};
