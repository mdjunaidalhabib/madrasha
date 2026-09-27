import { useLanguageStore } from "./languageStore";
import { TERMS, applyTerms, type Terms } from "./terms";
import type { InstitutionType, Lang } from "./types";

/**
 * A translation dictionary: the same shape in every language. Write the
 * Bangla text first - its shape becomes the type that `en`/`ar` must match,
 * so a missing key in either is a compile error.
 *
 *   const text = defineText({
 *     bn: { title: "{{student}} তালিকা", total: (n: string) => `মোট ${n} জন` },
 *     en: { title: "{{student}} List",   total: (n) => `Total ${n}` },
 *     ar: { title: "قائمة {{student}}",   total: (n) => `المجموع ${n}` },
 *   });
 *   const t = useText(text);  // t.title, t.total("5")
 *
 * String values (and function return values) may contain `{{term}}`
 * placeholders from terms.ts - replaced for the tenant's institution type.
 */
export type Dict<T> = { bn: T; en: T; ar: T };

export function defineText<T>(dict: { bn: T; en: NoInfer<T>; ar: NoInfer<T> }): Dict<T> {
  return dict;
}

/** For bn/en-only surfaces (the super-admin panel) - Arabic mirrors English. */
export function defineBilingualText<T>(dict: { bn: T; en: NoInfer<T> }): Dict<T> {
  return { bn: dict.bn, en: dict.en, ar: dict.en };
}

const isPlainObject =(value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;

function localize<T>(value: T, terms: Terms): T {
  if (typeof value === "string") return applyTerms(value, terms) as T;
  if (typeof value === "function") {
    const fn = value as unknown as (...args: unknown[]) => unknown;
    return ((...args: unknown[]) => localize(fn(...args), terms)) as T;
  }
  if (Array.isArray(value)) return value.map((item) => localize(item, terms)) as T;
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) out[key] = localize(value[key], terms);
    return out as T;
  }
  return value;
}

// Localized dictionaries are built once per (dictionary, language,
// institution type) - components re-render without re-walking the tree.
const cache = new WeakMap<object, Map<string, unknown>>();

export function resolveText<T>(dict: Dict<T>, lang: Lang, type: InstitutionType): T {
  let perDict = cache.get(dict);
  if (!perDict) {
    perDict = new Map();
    cache.set(dict, perDict);
  }
  const key = `${lang}:${type}`;
  if (!perDict.has(key)) {
    const source = dict[lang] ?? dict.bn;
    perDict.set(key, localize(source, TERMS[type][lang]));
  }
  return perDict.get(key) as T;
}

/** Dictionary in the user's current UI language. */
export function useText<T>(dict: Dict<T>): T {
  const lang = useLanguageStore((s) => s.lang);
  const type = useLanguageStore((s) => s.institution.type);
  return resolveText(dict, lang, type);
}

/** Dictionary in the institution's default language - for printed reports
 * and documents, which must read the same whoever prints them. */
export function usePrintText<T>(dict: Dict<T>): T {
  const lang = useLanguageStore((s) => s.institution.default_language);
  const type = useLanguageStore((s) => s.institution.type);
  return resolveText(dict, lang, type);
}

/** Non-hook variant for event handlers, services, toasts, utils. */
export function getText<T>(dict: Dict<T>): T {
  const { lang, institution } = useLanguageStore.getState();
  return resolveText(dict, lang, institution.type);
}

/** Non-hook print-language variant. */
export function getPrintText<T>(dict: Dict<T>): T {
  const { institution } = useLanguageStore.getState();
  return resolveText(dict, institution.default_language, institution.type);
}

export function useLang(): Lang {
  return useLanguageStore((s) => s.lang);
}

export function usePrintLang(): { lang: Lang; dir: "rtl" | "ltr" } {
  const lang = useLanguageStore((s) => s.institution.default_language);
  return { lang, dir: lang === "ar" ? "rtl" : "ltr" };
}

export function useInstitutionType(): InstitutionType {
  return useLanguageStore((s) => s.institution.type);
}

export function useIsMadrasa(): boolean {
  return useLanguageStore((s) => s.institution.type === "MADRASA");
}

/** Institution vocabulary in the current UI language. */
export function useTerms(): Terms {
  const lang = useLanguageStore((s) => s.lang);
  const type = useLanguageStore((s) => s.institution.type);
  return TERMS[type][lang];
}
