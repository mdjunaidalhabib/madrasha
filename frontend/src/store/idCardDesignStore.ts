import { create } from "zustand";
import { getIdCardDesign, type IdCardDesignResponse } from "../services/idCardDesignApi";

type State = {
  design: IdCardDesignResponse | null;
  loading: boolean;
  loaded: boolean;
  fetchDesign: (force?: boolean) => Promise<void>;
  setDesign: (design: IdCardDesignResponse) => void;
};

export const useIdCardDesignStore = create<State>((set, get) => ({
  design: null,
  loading: false,
  loaded: false,

  fetchDesign: async (force = false) => {
    if (get().loaded && !force) return;
    if (get().loading) return;

    set({ loading: true });
    try {
      const data = await getIdCardDesign();
      set({ design: data, loaded: true });
    } catch {
      // Fail silently — id cards should still render with the classic default.
      set({ loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  setDesign: (design) => set({ design }),
}));
