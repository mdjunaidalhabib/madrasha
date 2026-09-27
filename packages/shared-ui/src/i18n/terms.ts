import type { InstitutionType, Lang } from "./types";

/**
 * Institution-specific vocabulary. Any translated string may reference these
 * as `{{key}}` placeholders (e.g. "{{institution}} সেটিংস") - useText()
 * substitutes them for the tenant's institution type, so one dictionary
 * entry reads "মাদ্রাসা সেটিংস" for a madrasa and "বিদ্যালয় সেটিংস" for a school.
 */
export type Terms = {
  /** মাদ্রাসা / বিদ্যালয় / কলেজ / কিন্ডারগার্টেন */
  institution: string;
  /** Head of the institution: মুহতামিম / প্রধান শিক্ষক / অধ্যক্ষ */
  head: string;
  /** Academic/exam department: তা'লীমাত / একাডেমিক */
  academic: string;
  /** Administration/fees department: ইহতিমাম / প্রশাসন */
  admin: string;
  /** A taught subject: কিতাব / বিষয় */
  subject: string;
  /** Top-level grouping of classes: বিভাগ (মারহালা) / স্তর */
  division: string;
  /** শ্রেণি / Class */
  class: string;
  /** ছাত্র / শিক্ষার্থী */
  student: string;
  /** উস্তাদ / শিক্ষক */
  teacher: string;
  /** শিক্ষাবর্ষ / সেশন */
  session: string;
};

export type TermKey = keyof Terms;

const MADRASA: Record<Lang, Terms> = {
  bn: {
    institution: "মাদ্রাসা",
    head: "মুহতামিম",
    academic: "তা'লীমাত",
    admin: "ইহতিমাম",
    subject: "কিতাব",
    division: "বিভাগ",
    class: "শ্রেণি",
    student: "শিক্ষার্থী",
    teacher: "শিক্ষক",
    session: "শিক্ষাবর্ষ",
  },
  en: {
    institution: "Madrasa",
    head: "Muhtamim",
    academic: "Talimat",
    admin: "Ihtimam",
    subject: "Kitab",
    division: "Division",
    class: "Class",
    student: "Student",
    teacher: "Teacher",
    session: "Session",
  },
  ar: {
    institution: "المدرسة",
    head: "المهتمم",
    academic: "التعليمات",
    admin: "الاهتمام",
    subject: "الكتاب",
    division: "المرحلة",
    class: "الصف",
    student: "الطالب",
    teacher: "الأستاذ",
    session: "العام الدراسي",
  },
};

const generic = (institution: Record<Lang, string>, head: Record<Lang, string>): Record<Lang, Terms> => ({
  bn: {
    institution: institution.bn,
    head: head.bn,
    academic: "একাডেমিক",
    admin: "প্রশাসন",
    subject: "বিষয়",
    division: "স্তর",
    class: "শ্রেণি",
    student: "শিক্ষার্থী",
    teacher: "শিক্ষক",
    session: "শিক্ষাবর্ষ",
  },
  en: {
    institution: institution.en,
    head: head.en,
    academic: "Academic",
    admin: "Administration",
    subject: "Subject",
    division: "Level",
    class: "Class",
    student: "Student",
    teacher: "Teacher",
    session: "Academic Year",
  },
  ar: {
    institution: institution.ar,
    head: head.ar,
    academic: "الشؤون الأكاديمية",
    admin: "الإدارة",
    subject: "المادة",
    division: "المرحلة",
    class: "الصف",
    student: "الطالب",
    teacher: "المعلم",
    session: "العام الدراسي",
  },
});

export const TERMS: Record<InstitutionType, Record<Lang, Terms>> = {
  MADRASA,
  SCHOOL: generic(
    { bn: "বিদ্যালয়", en: "School", ar: "المدرسة" },
    { bn: "প্রধান শিক্ষক", en: "Head Teacher", ar: "مدير المدرسة" },
  ),
  COLLEGE: generic(
    { bn: "কলেজ", en: "College", ar: "الكلية" },
    { bn: "অধ্যক্ষ", en: "Principal", ar: "عميد الكلية" },
  ),
  KINDERGARTEN: generic(
    { bn: "কিন্ডারগার্টেন", en: "Kindergarten", ar: "الروضة" },
    { bn: "প্রধান শিক্ষক", en: "Head Teacher", ar: "المديرة" },
  ),
};

export const INSTITUTION_TYPE_LABELS: Record<InstitutionType, Record<Lang, string>> = {
  MADRASA: { bn: "মাদ্রাসা", en: "Madrasa", ar: "مدرسة دينية" },
  SCHOOL: { bn: "স্কুল", en: "School", ar: "مدرسة" },
  COLLEGE: { bn: "কলেজ", en: "College", ar: "كلية" },
  KINDERGARTEN: { bn: "কিন্ডারগার্টেন", en: "Kindergarten", ar: "روضة أطفال" },
};

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

/** Replaces `{{term}}` placeholders; unknown keys are left untouched. */
export function applyTerms(text: string, terms: Terms): string {
  if (!text.includes("{{")) return text;
  return text.replace(PLACEHOLDER, (match, key: string) =>
    key in terms ? terms[key as TermKey] : match,
  );
}
