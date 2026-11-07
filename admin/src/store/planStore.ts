import { create } from "zustand";
import type { MyPlan } from "../services/planApi";

export type PlanBlock = {
  message?: string;
  code?: string;
  endDate?: string | null;
  daysSinceExpiry?: number | null;
  retentionWarningDays?: number;
  retentionNotice?: string;
};
type PlanState = {
  plan: MyPlan | null;
  block: PlanBlock | null;
  setPlan: (plan: MyPlan) => void;
  setBlock: (block: PlanBlock) => void;
  reset: () => void;
};

export const usePlanStore = create<PlanState>((set) => ({
  plan: null,
  block: null,
  setPlan: (plan) => set({ plan, block: null }),
  setBlock: (block) => set({ block }),
  reset: () => set({ plan: null, block: null }),
}));
