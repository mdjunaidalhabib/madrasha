export const WEBSITE_STATUSES = ["active", "limited", "disabled"] as const;

export const DEFAULT_MADRASA_ROLES: Array<{ key: string; name: string }> = [
  { key: "MUHTAMIM", name: "মুহতামিম" },
  { key: "TALIMAT", name: "তালিমাত" },
  { key: "ACCOUNTANT", name: "হিসাবরক্ষক" },
];

export const DEFAULT_STUDENT_LIMIT = 100;
export const DEFAULT_USER_LIMIT = 5;

export const MADRASA_ACTIVITY = {
  CREATED: "MADRASA_CREATED",
  UPDATED: "SUPER_ADMIN_MADRASA_UPDATED",
} as const;
