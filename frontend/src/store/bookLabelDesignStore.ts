import { create } from "zustand";
import { getBookLabelDesign, type BookLabelDesignResponse } from "../services/bookLabelDesignApi";

type State = {
  design: BookLabelDesignResponse | null;
  loading: boolean;
  loaded: boolean;
  fetchDesign: (force?: boolean) => Promise<void>;
  setDesign: (design: BookLabelDesignResponse) => void;
};

export const useBookLabelDesignStore = create<State>((set, get) => ({
  design: null,
  loading: false,
  loaded: false,

  fetchDesign: async (force = false) => {
    if (get().loaded && !force) return;
    if (get().loading) return;

    set({ loading: true });
    try {
      const data = await getBookLabelDesign();
      set({ design: data, loaded: true });
    } catch {
      // Fail silently — book labels should still render with the classic default.
      set({ loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  setDesign: (design) => set({ design }),
}));
