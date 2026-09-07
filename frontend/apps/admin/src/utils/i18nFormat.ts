export type Lang = "bn" | "en" | "ar";

export const LOCALE_MAP: Record<Lang, string> = {
  bn: "bn-BD",
  en: "en-US",
  ar: "ar-EG",
};

export const formatNumber = (value: number | string, lang: Lang) =>
  Number(value || 0).toLocaleString(LOCALE_MAP[lang]);

// মাদরাসার হিসাব সবসময় টাকায়, তাই ভাষা বদলালেও কারেন্সি চিহ্ন অপরিবর্তিত থাকে —
// শুধু সংখ্যার অঙ্ক/সেপারেটর ভাষা অনুযায়ী বদলায়।
export const formatCurrency = (value: number | string, lang: Lang) => `৳ ${formatNumber(value, lang)}`;

export const formatDate = (date: string | number | Date, lang: Lang) =>
  new Date(date).toLocaleDateString(LOCALE_MAP[lang]);
