import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AuthUser = {
  id: number;
  madrasa_id?: number;
  name: string;
  email?: string;
  role?: string;
  role_key?: string;
  role_label?: string;
  mobile?: string | null;
  photo_url?: string | null;
};

export type AuthPayload = {
  token: string;
  user: AuthUser;
  permissions?: string[];
  modules?: string[];
};

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  permissions: string[];
  modules: string[];
  setAuth: (data: AuthPayload) => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  setAccess: (permissions: string[], modules: string[]) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      permissions: [],
      modules: [],

      setAuth: (data) => {
        set({
          token: data.token,
          user: {
            ...data.user,
            role: data.user.role || data.user.role_key,
          },
          permissions: data.permissions || [],
          modules: data.modules || [],
        });
      },

      updateUser: (patch) => {
        set((state) => ({ user: state.user ? { ...state.user, ...patch } : state.user }));
      },

      // Re-syncs just permissions/modules against the backend (see
      // DashboardLayout.tsx, called on every app load) without touching
      // token/user - so a module split or a role's permission edit reaches
      // an already-logged-in user without forcing them to log out first.
      setAccess: (permissions, modules) => {
        set({ permissions, modules });
      },

      logout: () => {
        set({ token: null, user: null, permissions: [], modules: [] });
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        permissions: state.permissions,
        modules: state.modules,
      }),
    },
  ),
);
