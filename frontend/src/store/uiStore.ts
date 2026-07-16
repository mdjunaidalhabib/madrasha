import { create } from "zustand";

type UIState = {
  isLocked: boolean;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  lock: () => void;
  unlock: () => void;
};

export const useUIStore = create<UIState>((set) => ({
  isLocked: localStorage.getItem("ui_lock") === "1",
  sidebarCollapsed: localStorage.getItem("sidebar_collapsed") === "1",

  toggleSidebar: () =>
    set((s) => {
      const next = !s.sidebarCollapsed;
      localStorage.setItem("sidebar_collapsed", next ? "1" : "0");
      return { sidebarCollapsed: next };
    }),

  lock: () => {
    localStorage.setItem("ui_lock", "1");
    set({ isLocked: true });
  },
  unlock: () => {
    localStorage.removeItem("ui_lock");
    set({ isLocked: false });
  },
}));
