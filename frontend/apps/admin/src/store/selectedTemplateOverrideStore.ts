import { create } from "zustand";

type State = {
  templateId: number | null;
  setTemplateId: (id: number | null) => void;
};

/**
 * Reports screen "use this specific published template instead of the
 * tenant's effective default" override - set by ReportShell when the user
 * picks one from ReportFilterBar's template <select>, and read by
 * ReportContent to pass down to IdCardGrid/AdmitCardGrid/SanadList/
 * TestimonialList/TransferLetterList as their `templateId` prop.
 *
 * A plain Zustand store instead of prop-drilling because ReportContent is
 * only ever rendered by PaginatedReportPreview, which sits between
 * ReportShell and ReportContent and is out of scope to modify here - same
 * reasoning as documentTemplateDefaultStore.ts, which solves an analogous
 * cross-layer read for the effective-default case.
 */
export const useSelectedTemplateOverrideStore = create<State>((set) => ({
  templateId: null,
  setTemplateId: (id) => set({ templateId: id }),
}));
