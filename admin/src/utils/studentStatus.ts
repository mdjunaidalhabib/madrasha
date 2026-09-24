/** students.is_active: 1 = সক্রিয়, 0 = বহিষ্কৃত, 2 = নিষ্ক্রিয় (সাময়িক; ফেরত সক্রিয় করা যায়)। */
export type StudentStatus = "ACTIVE" | "EXPELLED" | "INACTIVE";

export const studentStatus = (isActive: unknown): StudentStatus => {
  const n = Number(isActive);
  if (n === 0) return "EXPELLED";
  if (n === 2) return "INACTIVE";
  return "ACTIVE";
};

export const STUDENT_STATUS_LABEL: Record<StudentStatus, string> = {
  ACTIVE: "সক্রিয়",
  EXPELLED: "বহিষ্কৃত",
  INACTIVE: "নিষ্ক্রিয়",
};

export const studentStatusLabel = (isActive: unknown) => STUDENT_STATUS_LABEL[studentStatus(isActive)];

/** Badge colors per status (border + bg + text, light & dark). */
export const STUDENT_STATUS_BADGE_CLASS: Record<StudentStatus, string> = {
  ACTIVE:
    "border-green-300 bg-green-100 text-green-700 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-400",
  EXPELLED: "border-red-300 bg-red-100 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400",
  INACTIVE:
    "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
};
