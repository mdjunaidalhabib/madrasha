export const WEBSITE_STATUSES = ["active", "limited", "disabled"] as const;

export const DEFAULT_MADRASA_ROLES: Array<{ key: string; name: string }> = [
  { key: "MUHTAMIM", name: "মুহতামিম" },
  { key: "TALIMAT", name: "তালিমাত" },
  { key: "ACCOUNTANT", name: "হিসাবরক্ষক" },
];

export const DEFAULT_STUDENT_LIMIT = 100;
export const DEFAULT_USER_LIMIT = 5;

/** Exams created automatically for every newly provisioned madrasa, for the
 * academic year the madrasa is created in. Admins can rename/delete/add
 * more afterwards from the Exam Panel — these just give a working starting
 * point instead of an empty exam list. */
export const DEFAULT_EXAM_NAMES: string[] = [
  "প্রথম সাময়িক পরীক্ষা",
  "দ্বিতীয় সাময়িক পরীক্ষা",
  "বার্ষিক পরীক্ষা",
];

export const MADRASA_ACTIVITY = {
  CREATED: "MADRASA_CREATED",
  UPDATED: "SUPER_ADMIN_MADRASA_UPDATED",
} as const;
