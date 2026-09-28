/** UI/print languages the system ships translations for. */
export type Lang = "bn" | "en";

export type InstitutionType = "MADRASA" | "SCHOOL" | "COLLEGE" | "KINDERGARTEN";

/** Mirrors backend `InstitutionInfo` (shared/utils/institution.util.ts) -
 * delivered by login, /auth/me and the public website payload. */
export type InstitutionInfo = {
  type: InstitutionType;
  /** Super-admin controlled default; also the language every print/report uses. */
  default_language: Lang;
  /** Languages this tenant's users may switch between. */
  languages: Lang[];
};

export const LANGUAGE_LABELS: Record<Lang, string> = {
  bn: "বাংলা",
  en: "English",
};


export const isLang = (value: unknown): value is Lang => value === "bn" || value === "en";

export const INSTITUTION_TYPES: InstitutionType[] = ["MADRASA", "SCHOOL", "COLLEGE", "KINDERGARTEN"];

export const languagesForInstitution = (type: InstitutionType): Lang[] =>
  ["bn", "en"];

export const defaultLanguageForInstitution = (type: InstitutionType): Lang => (type === "MADRASA" ? "bn" : "en");

export const DEFAULT_INSTITUTION: InstitutionInfo = {
  type: "MADRASA",
  default_language: "bn",
  languages: ["bn", "en"],
};
