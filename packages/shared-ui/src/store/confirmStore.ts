import { create } from "zustand";

type ConfirmState = {
  open: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm?: () => Promise<void> | void;
  onCancel?: () => void;
  /** Bumped on every show() - lets ConfirmDialog detect whether its own
   * onConfirm handler re-opened the dialog (chaining a second confirmation
   * step) before blindly hiding it, see ConfirmDialog.tsx. Not meant to be
   * read/set by callers. */
  generation: number;
  show: (opts: Omit<ConfirmState, "open" | "show" | "hide" | "generation">) => void;
  hide: () => void;
};

export const useConfirmStore = create<ConfirmState>((set) => ({
  open: false,
  generation: 0,
  show: (opts) => set((state) => ({ open: true, ...opts, generation: state.generation + 1 })),
  hide: () => set({ open: false }),
}));
