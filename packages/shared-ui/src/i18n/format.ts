import type { Lang } from "./types";

export const LOCALE_MAP: Record<Lang, string> = {
  bn: "bn-BD",
  en: "en-US",
  // ar-EG (not ar-SA) - ar-SA formats dates on the Hijri calendar.
  ar: "ar-EG",
};

const DIGITS: Record<Lang, string | null> = {
  bn: "০১২৩৪৫৬৭৮৯",
  en: null,
  ar: "٠١٢٣٤٥٦٧٨٩",
};

const ANY_LOCAL_DIGIT = /[০-৯٠-٩]/g;

/** Rewrites every digit in `value` into `lang`'s numerals (ASCII for en). */
export const localizeDigits = (value: string | number, lang: Lang): string => {
  const ascii = String(value).replace(ANY_LOCAL_DIGIT, (d) => {
    const bn = DIGITS.bn!.indexOf(d);
    return String(bn >= 0 ? bn : DIGITS.ar!.indexOf(d));
  });
  const set = DIGITS[lang];
  return set ? ascii.replace(/\d/g, (d) => set[Number(d)]) : ascii;
};

/** Bangla/Arabic numerals -> ASCII, for parsing user input. */
export const toAsciiDigits = (value: string): string => localizeDigits(value, "en");

export const formatNumber = (value: number | string, lang: Lang) =>
  Number(toAsciiDigits(String(value ?? 0)) || 0).toLocaleString(LOCALE_MAP[lang]);

/** Money is always Taka - only the digits/separators follow the language. */
export const formatCurrency = (value: number | string, lang: Lang) => `৳ ${formatNumber(value, lang)}`;

export const formatDate = (
  date: string | number | Date,
  lang: Lang,
  options?: Intl.DateTimeFormatOptions,
) => {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(LOCALE_MAP[lang], options);
};

export const formatDateTime = (
  date: string | number | Date,
  lang: Lang,
  options?: Intl.DateTimeFormatOptions,
) => {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(LOCALE_MAP[lang], options);
};
