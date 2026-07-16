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

export const isTalimatPermission = (permission: string) =>
  permission.startsWith("talimat.") ||
  permission.startsWith("students.") ||
  permission.startsWith("exam.") ||
  permission.startsWith("result.");

export const isAccountsPermission = (permission: string) => permission.startsWith("accounts.");

/**
 * Permits specific roles to hold specific permissions even when the
 * role_permissions table hasn't been seeded with that grant yet.
 */
const permissionFallbackRoles: Record<string, string[]> = {
  "accounts.read": ["ACCOUNTANT"],
  "accounts.create": ["ACCOUNTANT"],
  "accounts.update": ["ACCOUNTANT"],
  "accounts.delete": ["ACCOUNTANT"],
  "talimat.manage": ["TALIMAT"],
  "students.read": ["TALIMAT"],
  "students.create": ["TALIMAT"],
  "students.update": ["TALIMAT"],
};

export const hasFallbackRole = (permission: string, role: string) => {
  const allowed = permissionFallbackRoles[permission] || [];
  return allowed.map(normalizeAppRole).includes(normalizeAppRole(role));
};

export const isRoleBasedPermission = (appRole: string, permission: string) =>
  (appRole === "TALIMAT" && isTalimatPermission(permission)) ||
  (appRole === "ACCOUNTANT" && isAccountsPermission(permission));
