/**
 * Historical role labels (English key or legacy Bengali label) that get
 * an implicit baseline set of permissions on login, even if role_permissions
 * hasn't been fully seeded for that role yet. Extracted unchanged from the
 * original auth.service.ts so behavior is identical.
 */
export const MUHTAMIM_ROLE_KEYS = ["MUHTAMIM", "মুহতামিম"] as const;
export const TALIMAT_ROLE_KEYS = ["TALIMAT", "তালিমাত"] as const;
export const ACCOUNTANT_ROLE_KEYS = ["ACCOUNTANT", "হিসাবরক্ষক", "হিসাব রক্ষক"] as const;

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

export const TALIMAT_BASELINE_PERMISSIONS = [
  "talimat.manage",
  "students.read",
  "students.create",
  "students.update",
] as const;

export const ACCOUNTANT_BASELINE_PERMISSIONS = [
  "accounts.read",
  "accounts.create",
  "accounts.update",
  "accounts.delete",
] as const;

export const DEFAULT_TOKEN_EXPIRY = "7d";
