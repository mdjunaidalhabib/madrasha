export const Roles = {
  SUPER_ADMIN: "SUPER_ADMIN",
  MADRASA_ADMIN: "MADRASA_ADMIN",
  TEACHER: "TEACHER",
  STUDENT: "STUDENT",
  GUARDIAN: "GUARDIAN",
} as const;

export type RoleKey = keyof typeof Roles | (typeof Roles)[keyof typeof Roles];

export const normalizeRole = (role?: string | null) =>
  String(role || "")
    .trim()
    .toUpperCase();

export const isSuperAdminRole = (role?: string | null) => normalizeRole(role) === Roles.SUPER_ADMIN;
