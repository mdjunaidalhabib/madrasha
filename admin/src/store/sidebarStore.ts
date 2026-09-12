import { create } from "zustand";

export type SidebarChildItem = {
  key: string;
  label: string;
  disabled?: boolean;
  count?: number;
};

export type SidebarItem = {
  key: string;
  label: string;
  group: string;
  disabled?: boolean;
  children: SidebarChildItem[];
};

type SidebarState = {
  items: SidebarItem[];
  loaded: boolean;
  setItems: (items: SidebarItem[]) => void;
};

export const useSidebarStore = create<SidebarState>((set) => ({
  items: [],
  loaded: false,
  setItems: (items) => set({ items, loaded: true }),
}));
