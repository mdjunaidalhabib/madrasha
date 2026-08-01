import { create } from "zustand";
import { getLetterDesign, type LetterDesignResponse } from "../services/letterDesignApi";

type State = {
  design: LetterDesignResponse | null;
  loading: boolean;
  loaded: boolean;
  fetchDesign: (force?: boolean) => Promise<void>;
  setDesign: (design: LetterDesignResponse) => void;
};

export const useLetterDesignStore = create<State>((set, get) => ({
  design: null,
  loading: false,
  loaded: false,

  fetchDesign: async (force = false) => {
    if (get().loaded && !force) return;
    if (get().loading) return;

    set({ loading: true });
    try {
      const data = await getLetterDesign();
      set({ design: data, loaded: true });
    } catch {
      // Fail silently — letters should still render with the classic default.
      set({ loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  setDesign: (design) => set({ design }),
}));
