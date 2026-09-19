import { normalizeRole } from "./roles";

/**
 * Bengali role labels stored on some historical rows/UI selections map
 * onto the canonical English role keys used everywhere else.
 */
const roleAliases: Record<string, string> = {
  মুহতামিম: "MUHTAMIM",
  তালিমাত: "TALIMAT",
  হিসাবরক্ষক: "ACCOUNTANT",
  "হিসাব রক্ষক": "ACCOUNTANT",
};

export const normalizeAppRole = (role?: string | null) => {
  const normalized = normalizeRole(role);
  return roleAliases[String(role || "").trim()] || normalized;
};

export const isMuhtamimRole = (role: string) => normalizeAppRole(role) === "MUHTAMIM";

export const isTalimatRole = (role?: string | null) => normalizeAppRole(role) === "TALIMAT";

/**
 * পরীক্ষা বিভাগ (exam department) permission namespaces. তালিমাত is the head
 * of the exam department, so it acts as that department's super admin: every
 * exam/marks/result/routine permission (plus exam/academic reports) is implied by the role
 * itself instead of needing a RolePermission row per key (which silently
 * broke whenever a new key was added to the catalog and the role wasn't
 * backfilled). Other modules (accounts, fee, students, ...) are NOT covered
 * - those still need explicit grants.
 */
const EXAM_DEPARTMENT_PERMISSION_PREFIXES = ["exam.", "marks.", "result.", "routine."];
const EXAM_DEPARTMENT_REPORT_PERMISSIONS = new Set(["reports.exam", "reports.academic"]);

export const isExamDepartmentPermission = (permission: string) =>
  EXAM_DEPARTMENT_PERMISSION_PREFIXES.some((prefix) => permission.startsWith(prefix)) ||
  EXAM_DEPARTMENT_REPORT_PERMISSIONS.has(permission);

/** True when the role holds `permission` purely by being that role - no
 * RolePermission lookup needed. Super Admin / Muhtamim: everything.
 * Talimat: everything in the exam department. */
export const roleImpliesPermission = (role: string | null | undefined, permission: string) => {
  const normalized = normalizeAppRole(role);
  if (normalized === "SUPER_ADMIN" || normalized === "MUHTAMIM") return true;
  return normalized === "TALIMAT" && isExamDepartmentPermission(permission);
};

/** Representative keys a role holds implicitly, for UI code that decides
 * what to SHOW (sidebar module visibility) from a list of granted keys
 * rather than asking "does the role hold exactly this key". One key per
 * exam-department namespace is enough for prefix matching. */
export const implicitPermissionKeysForRole = (role?: string | null): string[] =>
  isTalimatRole(role)
    ? ["exam.read", "marks.read", "result.read", "routine.read", ...EXAM_DEPARTMENT_REPORT_PERMISSIONS]
    : [];
