import { create } from "zustand";

/**
 * "auto" = কাগজ/সংখ্যা অনুযায়ী নিজে ঠিক করবে; "grid" = আইডি কার্ড একসাথে অনেকগুলো
 * (কাটার ফাঁকসহ); "1"/"2" = প্রতি পাতায় কতটি কার্ড।
 */
export type CardsPerPage = "auto" | "grid" | "1" | "2";

type State = {
  /** Positive = DB টেমপ্লেট, negative = বিল্ট-ইন ডিজাইন (দেখুন DocumentDesigner/builtin/registry), null = ডিফল্ট (সাধারণ)। */
  templateId: number | null;
  setTemplateId: (id: number | null) => void;
  /** আইডি কার্ড / প্রবেশপত্রের পাতা-বিন্যাস। */
  cardsPerPage: CardsPerPage;
  setCardsPerPage: (value: CardsPerPage) => void;
};

/**
 * Reports screen "use this specific design instead of the default (সাধারণ)"
 * override - set by ReportShell when the user picks one from
 * ReportFilterBar's design <select>, and read by ReportContent to pass down to
 * IdCardGrid/AdmitCardGrid/SanadList/TestimonialList/TransferLetterList/
 * MarksheetList as their `templateId` prop.
 *
 * A plain Zustand store instead of prop-drilling because ReportContent is
 * only ever rendered by PaginatedReportPreview, which sits between
 * ReportShell and ReportContent - same reasoning as before, now also
 * carrying the cards-per-page layout choice.
 */
export const useSelectedTemplateOverrideStore = create<State>((set) => ({
  templateId: null,
  setTemplateId: (id) => set({ templateId: id }),
  cardsPerPage: "auto",
  setCardsPerPage: (value) => set({ cardsPerPage: value }),
}));
