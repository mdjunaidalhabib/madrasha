import { create } from "zustand";
import { getIdCardBack, type IdCardBackSettings } from "../services/idCardBackApi";

type State = {
  settings: IdCardBackSettings | null;
  loading: boolean;
  loaded: boolean;
  fetchSettings: (force?: boolean) => Promise<void>;
  setSettings: (settings: IdCardBackSettings) => void;
  reset: () => void;
};

export const useIdCardBackStore = create<State>((set, get) => ({
  settings: null,
  loading: false,
  loaded: false,

  fetchSettings: async (force = false) => {
    if (get().loaded && !force) return;
    if (get().loading) return;

    set({ loading: true });
    try {
      set({ settings: await getIdCardBack(), loaded: true });
    } catch {
      // Fail silently — the card back still renders (blank issue/expiry/signature).
      set({ loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  setSettings: (settings) => set({ settings }),

  reset: () => set({ settings: null, loading: false, loaded: false }),
}));
