import { create } from "zustand";
import { getBranding, type BrandingPayload } from "../services/brandingApi";

type State = {
  branding: BrandingPayload | null;
  loading: boolean;
  loaded: boolean;
  fetchBranding: (force?: boolean) => Promise<void>;
  setBranding: (branding: BrandingPayload) => void;
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
}));
