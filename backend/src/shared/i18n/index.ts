import { AsyncLocalStorage } from "async_hooks";
import type { RequestHandler } from "express";
import type { AppLanguage } from "../utils/institution.util";

/**
 * Per-request UI language. The frontends send the user's current language
 * as `Accept-Language` (bn | en); every user-facing message the API
 * returns (errors, validation, success toasts) should go through t() so it
 * arrives in that language:
 *
 *   throw new NotFoundError(t({ bn: "ছাত্র পাওয়া যায়নি", en: "Student not found" }));
 *
 * Outside a request (cron jobs, scripts) t() falls back to Bangla.
 * SMS/print text is NOT the request language - it must use the institution
 * default (see resolveDefaultLanguage in utils/institution.util.ts) and
 * tFor(lang, dict).
 */
export type Localized = { bn: string; en: string };

const storage = new AsyncLocalStorage<{ lang: AppLanguage }>();

const parseAcceptLanguage = (header: string | undefined): AppLanguage => {
  const primary = String(header || "")
    .split(",")[0]
    .trim()
    .slice(0, 2)
    .toLowerCase();
  return primary === "en" ? "en" : "bn";
};

export const requestLanguageMiddleware: RequestHandler = (req, _res, next) => {
  storage.run({ lang: parseAcceptLanguage(req.headers["accept-language"]) }, next);
};

export const currentLanguage = (): AppLanguage => storage.getStore()?.lang ?? "bn";

/** Message in an explicit language. */
export const tFor = (lang: AppLanguage, dict: Localized): string =>
  dict[lang];

/** Message in the current request's language. */
export const t = (dict: Localized): string => tFor(currentLanguage(), dict);
