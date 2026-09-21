import { create } from "zustand";

export type ToastType = "success" | "error" | "info";

export type Toast = {
  id: string;
  type: ToastType;
  message: string;
  // Shows a spinner - for a long-running action's "in progress" message.
  loading?: boolean;
};

export type ToastOptions = {
  // ms before auto-dismiss. 0 = stays until removed/updated (or the user
  // closes it). Defaults to DEFAULT_DURATION_MS.
  duration?: number;
  loading?: boolean;
};

const DEFAULT_DURATION_MS = 3000;

type State = {
  toasts: Toast[];

  // new (recommended). Returns the toast id so a long-running action can
  // later `update()` the same toast in place instead of stacking new ones.
  show: (message: string, type?: ToastType, options?: ToastOptions) => string;

  // Edits a toast in place (message/type/spinner) and restarts its dismiss
  // timer - e.g. "PDF তৈরি হচ্ছে..." -> "ডাউনলোড শুরু হচ্ছে..." -> "হয়েছে".
  update: (id: string, patch: Partial<Omit<Toast, "id">> & { duration?: number }) => void;

  // old (kept for compatibility)
  push: (type: ToastType, message: string) => void;

  remove: (id: string) => void;
  clear: () => void;
};

const timers = new Map<string, ReturnType<typeof setTimeout>>();

export const useToastStore = create<State>((set, get) => {
  const schedule = (id: string, duration: number) => {
    const existing = timers.get(id);
    if (existing) clearTimeout(existing);
    timers.delete(id);
    if (duration > 0) timers.set(id, setTimeout(() => get().remove(id), duration));
  };

  return {
    toasts: [],

    // ✅ Preferred usage
    show: (message, type = "info", options = {}) => {
      const id = crypto.randomUUID();
      const toast: Toast = { id, type, message, loading: options.loading };

      set({
        toasts: [toast, ...get().toasts].slice(0, 5),
      });

      schedule(id, options.duration ?? DEFAULT_DURATION_MS);
      return id;
    },

    update: (id, { duration, ...patch }) => {
      if (!get().toasts.some((t) => t.id === id)) return;
      set({
        toasts: get().toasts.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      });
      schedule(id, duration ?? DEFAULT_DURATION_MS);
    },

    // ✅ Old usage still works
    push: (type, message) => {
      get().show(message, type);
    },

    remove: (id) => {
      const existing = timers.get(id);
      if (existing) clearTimeout(existing);
      timers.delete(id);
      set({
        toasts: get().toasts.filter((t) => t.id !== id),
      });
    },

    clear: () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
      set({ toasts: [] });
    },
  };
});
