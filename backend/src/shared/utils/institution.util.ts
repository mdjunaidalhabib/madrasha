import type { InstitutionType } from "@prisma/client";

/** UI/print languages the system ships translations for. */
export type AppLanguage = "bn" | "en";

export const INSTITUTION_TYPES: InstitutionType[] = ["MADRASA", "SCHOOL", "COLLEGE", "KINDERGARTEN"];

/** Every institution type offers Bangla + English. */
export function languagesForInstitution(type: InstitutionType): AppLanguage[] {
  return ["bn", "en"];
}

/** A madrasa defaults to Bangla, every other institution type to English -
 * super admin can override per tenant via Madrasa.defaultLanguage. */
export function defaultLanguageForInstitution(type: InstitutionType): AppLanguage {
  return type === "MADRASA" ? "bn" : "en";
}

/** Effective default language: the super-admin override when it's one this
 * institution type actually offers, else the type's own default. */
export function resolveDefaultLanguage(type: InstitutionType, stored?: string | null): AppLanguage {
  const allowed = languagesForInstitution(type);
  return stored && (allowed as string[]).includes(stored)
    ? (stored as AppLanguage)
    : defaultLanguageForInstitution(type);
}

export function parseInstitutionType(value: unknown): InstitutionType | undefined {
  const upper = typeof value === "string" ? value.trim().toUpperCase() : "";
  return (INSTITUTION_TYPES as string[]).includes(upper) ? (upper as InstitutionType) : undefined;
}

/** Validates a super-admin supplied default language. "" / null clears the
 * override (falls back to the type default); anything unknown is rejected
 * by returning undefined so the caller can leave the column untouched. */
export function parseLanguage(value: unknown): AppLanguage | null | undefined {
  if (value === null || value === "") return null;
  return value === "bn" || value === "en" ? value : undefined;
}

/** The `institution` block every tenant-facing bootstrap response carries
 * (login, /auth/me, public website) - the frontends drive terminology and
 * the language switcher entirely off this. */
export type InstitutionInfo = {
  type: InstitutionType;
  default_language: AppLanguage;
  languages: AppLanguage[];
};

export function buildInstitutionInfo(madrasa?: {
  institutionType?: InstitutionType | null;
  defaultLanguage?: string | null;
} | null): InstitutionInfo {
  const type = madrasa?.institutionType ?? "MADRASA";
  return {
    type,
    default_language: resolveDefaultLanguage(type, madrasa?.defaultLanguage),
    languages: languagesForInstitution(type),
  };
}
