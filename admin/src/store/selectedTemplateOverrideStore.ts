import { create } from "zustand";
import { DEFAULT_ID_CARD_BACK_ID } from "@madrasha/shared-ui/src/components/DocumentDesigner/builtin/registry";

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
  /**
   * আইডি কার্ডের পিছনের পাতা: বিল্ট-ইন পিছনের ডিজাইনের id (ঋণাত্মক), null = পিছনের পাতা ছাড়া
   * (শুধু সামনে)। শুরুতে ডিফল্ট পিছনের ডিজাইন বাছা থাকে।
   */
  idCardBackId: number | null;
  setIdCardBackId: (id: number | null) => void;
  /**
   * আইডি কার্ড রিপোর্টে "একক শিক্ষার্থী" মোডে সামনের সাথে একই পাতায় ছাপার পিছনের ডিজাইন (উপরে সামনে,
   * নিচে পিছনে)। ডিফল্টে দুই পাশ; null = শুধু সামনে। "আইডি কার্ড ব্যাক" রিপোর্টের idCardBackId থেকে আলাদা।
   */
  idCardPairBackId: number | null;
  setIdCardPairBackId: (id: number | null) => void;
  /** "আইডি কার্ড ব্যাক" রিপোর্টে "একক শিক্ষার্থী" মোডে পিছনের সাথে সামনেও একই পাতায় ছাপা হবে কি না (ডিফল্ট: হ্যাঁ - দুই পাশ)। */
  idCardBackWithFront: boolean;
  setIdCardBackWithFront: (value: boolean) => void;
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
  idCardBackId: DEFAULT_ID_CARD_BACK_ID,
  setIdCardBackId: (id) => set({ idCardBackId: id }),
  idCardPairBackId: DEFAULT_ID_CARD_BACK_ID,
  setIdCardPairBackId: (id) => set({ idCardPairBackId: id }),
  idCardBackWithFront: true,
  setIdCardBackWithFront: (value) => set({ idCardBackWithFront: value }),
}));
