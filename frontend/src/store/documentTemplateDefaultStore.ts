import { create } from "zustand";
import { getEffectiveDefault, type TemplateDetailDto } from "../services/documentTemplateLibraryApi";
import type { BackendDocumentType } from "../components/DocumentDesigner/documentTypeMap";

type State = {
  defaults: Partial<Record<BackendDocumentType, TemplateDetailDto | null>>;
  loading: Partial<Record<BackendDocumentType, boolean>>;
  loaded: Partial<Record<BackendDocumentType, boolean>>;
  fetchDefault: (type: BackendDocumentType, force?: boolean) => Promise<void>;
};

/**
 * Fetch-once cache for each document type's effective default template
 * (own tenant default, or the SYSTEM default via lazy auto-migration).
 * Read by IdCardGrid/AdmitCardGrid AND subscribed to by
 * PaginatedReportPreview's pagination measurement effect - the fetch is
 * async, but the print pipeline's off-screen measurement pass
 * (useLayoutEffect) runs synchronously right after mount, so without this
 * shared, observable "loaded" flag the very first measurement pass would
 * see an empty grid (0 cards) and mis-paginate permanently. Subscribing to
 * `loaded` gives PaginatedReportPreview a signal to re-run measurement once
 * the template arrives, the same way it already re-runs on
 * `document.fonts.ready`.
 */
export const useDocumentTemplateDefaultStore = create<State>((set, get) => ({
  defaults: {},
  loading: {},
  loaded: {},

  fetchDefault: async (type, force = false) => {
    if (get().loaded[type] && !force) return;
    if (get().loading[type]) return;

    set((s) => ({ loading: { ...s.loading, [type]: true } }));
    try {
      const detail = await getEffectiveDefault(type);
      set((s) => ({ defaults: { ...s.defaults, [type]: detail }, loaded: { ...s.loaded, [type]: true } }));
    } catch {
      // Fail silently - the grid just renders nothing for this type rather
      // than crashing the whole report page.
      set((s) => ({ defaults: { ...s.defaults, [type]: null }, loaded: { ...s.loaded, [type]: true } }));
    } finally {
      set((s) => ({ loading: { ...s.loading, [type]: false } }));
    }
  },
}));
