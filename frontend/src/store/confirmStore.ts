import { create } from "zustand";

type ConfirmState = {
  open: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm?: () => Promise<void> | void;
  onCancel?: () => void;
  show: (opts: Omit<ConfirmState, "open" | "show" | "hide">) => void;
  hide: () => void;
};

export const useConfirmStore = create<ConfirmState>((set) => ({
  open: false,
  show: (opts) => set({ open: true, ...opts }),
  hide: () => set({ open: false }),
}));
