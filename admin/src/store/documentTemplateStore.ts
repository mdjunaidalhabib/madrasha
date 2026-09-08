import { create } from "zustand";
import {
  getDocumentTemplates,
  type DocumentTemplateResponse,
} from "../services/documentTemplateApi";

type State = {
  templates: DocumentTemplateResponse | null;
  loading: boolean;
  loaded: boolean;
  fetchTemplates: (force?: boolean) => Promise<void>;
  setTemplates: (templates: DocumentTemplateResponse) => void;
};

export const useDocumentTemplateStore = create<State>((set, get) => ({
  templates: null,
  loading: false,
  loaded: false,

  fetchTemplates: async (force = false) => {
    if (get().loaded && !force) return;
    if (get().loading) return;

    set({ loading: true });
    try {
      const data = await getDocumentTemplates();
      set({ templates: data, loaded: true });
    } catch {
      // Fail silently — print pages should still render with default wording.
      set({ loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  setTemplates: (templates) => set({ templates }),
}));
