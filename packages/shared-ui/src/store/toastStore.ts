import { create } from "zustand";

export type ToastType = "success" | "error" | "info";

export type Toast = {
  id: string;
  type: ToastType;
  message: string;
};

type State = {
  toasts: Toast[];

  // new (recommended)
  show: (message: string, type?: ToastType) => void;

  // old (kept for compatibility)
  push: (type: ToastType, message: string) => void;

  remove: (id: string) => void;
  clear: () => void;
};

export const useToastStore = create<State>((set, get) => ({
  toasts: [],

  // ✅ Preferred usage
  show: (message, type = "info") => {
    const id = crypto.randomUUID();
    const toast: Toast = { id, type, message };

    set({
      toasts: [toast, ...get().toasts].slice(0, 5),
    });

    setTimeout(() => get().remove(id), 3000);
  },

  // ✅ Old usage still works
  push: (type, message) => {
    const id = crypto.randomUUID();
    const toast: Toast = { id, type, message };

    set({
      toasts: [toast, ...get().toasts].slice(0, 5),
    });

    setTimeout(() => get().remove(id), 3000);
  },

  remove: (id) =>
    set({
      toasts: get().toasts.filter((t) => t.id !== id),
    }),

  clear: () => set({ toasts: [] }),
}));
