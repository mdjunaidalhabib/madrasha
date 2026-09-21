import { create } from "zustand";
import { noticeApi, type NoticeDto } from "../services/noticeApi";

type State = {
  /** null = এখনো লোড হয়নি। */
  notices: NoticeDto[] | null;
  selectedId: number | null;
  setSelectedId: (id: number | null) => void;
  load: () => Promise<void>;
};

/**
 * "নোটিশ বোর্ড" রিপোর্টের নোটিশ-তালিকা ও বাছাই করা নোটিশ। বাছাইয়ের ড্রপডাউন থাকে রিপোর্টের উপরের
 * ফিল্টার বারে (ReportFilterBar), আর নোটিশ দেখায় NoticeBoardReportView - মাঝে PaginatedReportPreview
 * থাকায় props না দিয়ে selectedTemplateOverrideStore-এর মতোই স্টোরে রাখা হয়েছে।
 * প্রতিবার রিপোর্ট খুললে নতুন তালিকা আনে, কারণ নোটিশ পেজে তৈরি/এডিট/ডিলিট চলতেই থাকে।
 */
export const useNoticeBoardReportStore = create<State>((set, get) => ({
  notices: null,
  selectedId: null,
  setSelectedId: (id) => set({ selectedId: id }),
  load: async () => {
    try {
      const res = await noticeApi.list();
      const list = res.data?.data || [];
      const current = get().selectedId;
      set({
        notices: list,
        selectedId: list.some((n) => n.id === current) ? current : (list[0]?.id ?? null),
      });
    } catch {
      set({ notices: [], selectedId: null });
    }
  },
}));
