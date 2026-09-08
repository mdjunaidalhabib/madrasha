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
  /** Madrasa code entered on the login form - there's no slug in the URL
   * anymore, so this is now the only record of which tenant this session
   * belongs to (sent as the X-Madrasa-Slug header on every request). */
  madrasaSlug?: string;
};

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  permissions: string[];
  modules: string[];
  madrasaSlug: string | null;
  setAuth: (data: AuthPayload) => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  setAccess: (permissions: string[], modules: string[]) => void;
  /** Swaps in a freshly-issued access token without touching user/permissions
   * (see api.ts's 401 response interceptor, which calls this after a
   * successful /auth/refresh instead of a full re-login). */
  setToken: (token: string) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      permissions: [],
      modules: [],
      madrasaSlug: null,

      setAuth: (data) => {
        set({
          token: data.token,
          user: {
            ...data.user,
            role: data.user.role || data.user.role_key,
          },
          permissions: data.permissions || [],
          modules: data.modules || [],
          ...(data.madrasaSlug ? { madrasaSlug: data.madrasaSlug } : {}),
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

      setToken: (token) => {
        set({ token });
      },

      logout: () => {
        set({ token: null, user: null, permissions: [], modules: [], madrasaSlug: null });
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        permissions: state.permissions,
        modules: state.modules,
        madrasaSlug: state.madrasaSlug,
      }),
    },
  ),
);
