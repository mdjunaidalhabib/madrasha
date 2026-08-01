import { create } from "zustand";
import { getAdmitCardDesign, type AdmitCardDesignResponse } from "../services/admitCardDesignApi";

type State = {
  design: AdmitCardDesignResponse | null;
  loading: boolean;
  loaded: boolean;
  fetchDesign: (force?: boolean) => Promise<void>;
  setDesign: (design: AdmitCardDesignResponse) => void;
};

export const useAdmitCardDesignStore = create<State>((set, get) => ({
  design: null,
  loading: false,
  loaded: false,

  fetchDesign: async (force = false) => {
    if (get().loaded && !force) return;
    if (get().loading) return;

    set({ loading: true });
    try {
      const data = await getAdmitCardDesign();
      set({ design: data, loaded: true });
    } catch {
      // Fail silently — admit cards should still render with the classic default.
      set({ loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  setDesign: (design) => set({ design }),
}));
