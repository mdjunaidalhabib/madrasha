export const leadStatuses = ["NEW", "CONTACTED", "DEMO_SCHEDULED", "CONVERTED", "LOST"] as const;
export type LeadStatus = typeof leadStatuses[number];
export type Lead = {
  id: number; name: string; phone: string; institution: string; institutionType: string;
  studentCount: string | null; message: string | null; status: LeadStatus;
  notes: string | null; followUpAt: string | null; createdAt: string;
  utmSource: string | null; utmMedium: string | null; utmCampaign: string | null;
  utmContent: string | null; utmTerm: string | null; fbclid: string | null; landingPath: string | null;
};
export type LeadSummaryData = { total: number; today: number; due: number; counts: Record<LeadStatus, number>; recent: Lead[] };
export const statusLabels: Record<LeadStatus, [string, string]> = {
  NEW: ["নতুন", "New"], CONTACTED: ["যোগাযোগ হয়েছে", "Contacted"],
  DEMO_SCHEDULED: ["ডেমো নির্ধারিত", "Demo scheduled"], CONVERTED: ["গ্রাহক হয়েছেন", "Converted"], LOST: ["আগ্রহী নন", "Lost"],
};
export const statusColors: Record<LeadStatus, string> = {
  NEW: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  CONTACTED: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  DEMO_SCHEDULED: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  CONVERTED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  LOST: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};
export const leadDate = (date: string, bn: boolean) => new Intl.DateTimeFormat(bn ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
