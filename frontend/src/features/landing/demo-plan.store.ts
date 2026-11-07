import { create } from "zustand";

export type DemoPlanIntent = { planId: number | null; studentCount: number | null; custom: boolean };
/** In-memory handoff between pricing and the existing demo form. No tenant or
 * contact information is persisted in browser storage. Prices are re-read. */
export const useDemoPlanStore = create<{
  intent: DemoPlanIntent | null;
  choose: (intent: DemoPlanIntent) => void;
}>((set) => ({ intent: null, choose: (intent) => set({ intent }) }));
