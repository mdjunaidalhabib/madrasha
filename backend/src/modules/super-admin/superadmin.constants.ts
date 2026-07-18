export const WEBSITE_STATUSES = ["active", "limited", "disabled"] as const;

export const DEFAULT_MADRASA_ROLES: Array<{ key: string; name: string }> = [
  { key: "MUHTAMIM", name: "মুহতামিম" },
  { key: "TALIMAT", name: "তালিমাত" },
  { key: "ACCOUNTANT", name: "হিসাবরক্ষক" },
];

export const DEFAULT_STUDENT_LIMIT = 100;
export const DEFAULT_USER_LIMIT = 5;

/** Exam, grade, and setting defaults are stored in the database by
 * prisma/seed.ts. This keeps seed.ts as the single source of truth for
 * future madrasa provisioning. */

export const MADRASA_ACTIVITY = {
  CREATED: "MADRASA_CREATED",
  UPDATED: "SUPER_ADMIN_MADRASA_UPDATED",
} as const;
