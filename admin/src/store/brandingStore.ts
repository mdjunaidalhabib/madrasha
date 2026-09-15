import { create } from "zustand";
import { getBranding, type BrandingPayload } from "../services/brandingApi";

type State = {
  branding: BrandingPayload | null;
  loading: boolean;
  loaded: boolean;
  fetchBranding: (force?: boolean) => Promise<void>;
  setBranding: (branding: BrandingPayload) => void;
  reset: () => void;
};

export const useBrandingStore = create<State>((set, get) => ({
  branding: null,
  loading: false,
  loaded: false,

  fetchBranding: async (force = false) => {
    if (get().loaded && !force) return;
    if (get().loading) return;

    set({ loading: true });
    try {
      const data = await getBranding();
      set({ branding: data, loaded: true });
    } catch {
      // Fail silently — report pages should still render without branding.
      set({ loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  setBranding: (branding) => set({ branding }),

  // লগআউটে কল হয় - না হলে `loaded` true-ই থেকে যায় এবং নতুন মাদরাসায়
  // লগইন করলেও fetchBranding() পুরনো ট্যানেন্টের branding সার্ভ করতে থাকে
  // (রিফ্রেশ না করা পর্যন্ত), কারণ SPA নেভিগেশনে মডিউল স্টেট রিসেট হয় না।
  reset: () => set({ branding: null, loading: false, loaded: false }),
}));
