import { create } from "zustand";
import { getTemplate, type TemplateDetailDto } from "../services/documentTemplateLibraryApi";

type State = {
  /** undefined = এখনো আনা হয়নি, null = আনতে ব্যর্থ, বাকিটা লোড হওয়া টেমপ্লেট। */
  details: Record<number, TemplateDetailDto | null | undefined>;
  /** প্রতিবার কোনো টেমপ্লেট লোড শেষ হলে বাড়ে - PaginatedReportPreview এটা সাবস্ক্রাইব
   * করে পেজিনেশন আবার মাপার সংকেত হিসেবে (দেখুন documentTemplateDefaultStore-এর ব্যাখ্যা)। */
  version: number;
  ensure: (id: number) => void;
};

const inflight = new Set<number>();

/** স্পষ্টভাবে নির্বাচিত DB টেমপ্লেটের বিস্তারিত - একবার এনে ক্যাশ রাখে। */
export const useDocumentTemplateDetailStore = create<State>((set, get) => ({
  details: {},
  version: 0,

  ensure: (id) => {
    if (get().details[id] !== undefined || inflight.has(id)) return;
    inflight.add(id);
    getTemplate(id)
      .then((detail) => set((s) => ({ details: { ...s.details, [id]: detail }, version: s.version + 1 })))
      .catch(() => set((s) => ({ details: { ...s.details, [id]: null }, version: s.version + 1 })))
      .finally(() => inflight.delete(id));
  },
}));
