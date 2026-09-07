import { create } from "zustand";
import type { MyPlan } from "../services/planApi";

type PlanState = {
  plan: MyPlan | null;
  setPlan: (plan: MyPlan) => void;
};

export const usePlanStore = create<PlanState>((set) => ({
  plan: null,
  setPlan: (plan) => set({ plan }),
}));
