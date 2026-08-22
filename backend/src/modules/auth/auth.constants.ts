/**
 * MUHTAMIM (madrasa owner/principal) bypasses permission checks entirely on
 * the backend (see isMuhtamimRole short-circuit in rbac.middleware.ts) and
 * on the frontend (see frontend/src/utils/permissions.ts's hasPermission
 * helper) — it never needs its access read from this list. This baseline is
 * only used to populate the `permissions[]` array returned at login so
 * MUHTAMIM's own UI has a non-empty list to display, purely informational.
 *
 * TALIMAT/ACCOUNTANT no longer have a hardcoded baseline here — their real
 * access now comes entirely from seeded RolePermission rows (see
 * shared/permissions/baseline-role-permissions.ts), the same mechanism used
 * for custom roles.
 */
export const MUHTAMIM_ROLE_KEYS = ["MUHTAMIM", "মুহতামিম"] as const;

export const MUHTAMIM_BASELINE_PERMISSIONS = [
  "students.read",
  "students.create",
  "students.update",
  "students.delete",
  "users.read",
  "users.create",
  "users.delete",
  "accounts.read",
  "accounts.create",
  "accounts.update",
  "accounts.delete",
  "talimat.manage",
  "activity.read",
] as const;

export const DEFAULT_TOKEN_EXPIRY = "7d";

/** How long a forgot-password link stays valid. */
export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Account lockout after repeated failed logins (Security Optimization). */
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const ACCOUNT_LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
