import { create } from "zustand";

type SidebarItem = {
  key: string;
  label: string;
  group: string;
  disabled?: boolean;
  children: {
    key: string;
    label: string;
    disabled?: boolean;
  }[];
};

type SidebarState = {
  items: SidebarItem[];
  setItems: (items: SidebarItem[]) => void;
};

export const useSidebarStore = create<SidebarState>((set) => ({
  items: [],
  setItems: (items) => set({ items }),
}));
