import { create } from "zustand";
import { getSectionToggles, saveSectionToggle, type SectionTogglesPayload } from "../services/sectionTogglesApi";
import { useToastStore } from "./toastStore";

type State = {
  toggles: SectionTogglesPayload;
  loading: boolean;
  loaded: boolean;
  fetchToggles: (force?: boolean) => Promise<void>;
  isEnabled: (key: string) => boolean;
  setToggle: (key: string, enabled: boolean) => Promise<void>;
};

export const useSectionTogglesStore = create<State>((set, get) => ({
  toggles: {},
  loading: false,
  loaded: false,

  fetchToggles: async (force = false) => {
    if (get().loaded && !force) return;
    if (get().loading) return;

    set({ loading: true });
    try {
      const data = await getSectionToggles();
      set({ toggles: data, loaded: true });
    } catch {
      // Fail silently — settings pages default every section to enabled.
      set({ loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  // Missing key = enabled by default (backward compatible with tenants that
  // never touched this setting).
  isEnabled: (key) => get().toggles[key] !== false,

  setToggle: async (key, enabled) => {
    const previous = get().toggles;
    set({ toggles: { ...previous, [key]: enabled } });
    try {
      const data = await saveSectionToggle(key, enabled);
      set({ toggles: data });
      useToastStore.getState().show("সংরক্ষণ হয়েছে।", "success");
    } catch {
      set({ toggles: previous });
      useToastStore.getState().show("সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।", "error");
    }
  },
}));
