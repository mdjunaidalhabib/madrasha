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
