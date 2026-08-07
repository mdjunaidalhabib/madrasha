import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AuthUser = {
  id: number;
  madrasa_id?: number;
  name: string;
  email?: string;
  role?: string;
  role_key?: string;
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
