import { create } from "zustand";
import { DEFAULT_INSTITUTION, RTL_LANGS, isLang, type InstitutionInfo, type Lang } from "./types";

/** The user's own explicit pick from the language switcher (per device). */
const LANG_KEY = "app-language";
/** Last known tenant institution info, so the login page and a hard reload
 * render in the right language/terminology before /auth/me answers. */
const INSTITUTION_KEY = "app-institution";

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode etc.) - choice just won't persist */
  }
};

const readInstitution = (): InstitutionInfo => {
  try {
    const parsed = JSON.parse(read(INSTITUTION_KEY) || "null");
    if (parsed && parsed.type && isLang(parsed.default_language) && Array.isArray(parsed.languages)) {
      return parsed as InstitutionInfo;
    }
  } catch {
    /* ignore corrupt cache */
  }
  return DEFAULT_INSTITUTION;
};

/** User's explicit choice when this institution offers it, else the
 * institution's (super-admin controlled) default. */
const resolveLang = (institution: InstitutionInfo): Lang => {
  const chosen = read(LANG_KEY);
  return isLang(chosen) && institution.languages.includes(chosen) ? chosen : institution.default_language;
};

export const applyDocumentLang = (lang: Lang) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.lang = lang;
  root.dir = RTL_LANGS.includes(lang) ? "rtl" : "ltr";
};

type LanguageState = {
  /** Current UI language. */
  lang: Lang;
  institution: InstitutionInfo;
  /** Explicit user pick - remembered on this device. */
  setLang: (lang: Lang) => void;
  /** Call whenever the backend reports the tenant's institution info
   * (login, /auth/me, public website load). */
  setInstitution: (institution: InstitutionInfo | null | undefined) => void;
};

const initialInstitution = readInstitution();
const initialLang = resolveLang(initialInstitution);
applyDocumentLang(initialLang);

export const useLanguageStore = create<LanguageState>((set, get) => ({
  lang: initialLang,
  institution: initialInstitution,

  setLang: (lang) => {
    if (!get().institution.languages.includes(lang)) return;
    write(LANG_KEY, lang);
    applyDocumentLang(lang);
    set({ lang });
  },

  setInstitution: (institution) => {
    if (!institution || !institution.type) return;
    const languages = institution.languages?.length ? institution.languages : DEFAULT_INSTITUTION.languages;
    const next: InstitutionInfo = {
      type: institution.type,
      languages,
      default_language: isLang(institution.default_language) ? institution.default_language : languages[0],
    };
    write(INSTITUTION_KEY, JSON.stringify(next));
    const lang = resolveLang(next);
    applyDocumentLang(lang);
    set({ institution: next, lang });
  },
}));

/** Non-hook accessors for services, toasts and other code outside React. */
export const getLang = (): Lang => useLanguageStore.getState().lang;
export const getPrintLang = (): Lang => useLanguageStore.getState().institution.default_language;
export const getInstitution = (): InstitutionInfo => useLanguageStore.getState().institution;

/** Adds `Accept-Language: <current UI language>` to every request of an
 * axios instance, so the backend's t() answers in the user's language. */
export const attachLanguageHeader = (instance: {
  interceptors: { request: { use: (fn: (config: any) => any) => unknown } };
}) => {
  instance.interceptors.request.use((config) => {
    config.headers = config.headers ?? {};
    config.headers["Accept-Language"] = useLanguageStore.getState().lang;
    return config;
  });
};
