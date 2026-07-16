import { create } from "zustand";

type Admin = {
  id: number;
  name: string;
  email: string;
};

type AdminAuthState = {
  token: string | null;
  admin: Admin | null;

  setAuth: (data: { token: string; admin: Admin }) => void;
  logout: () => void;
};

export const useAdminAuthStore = create<AdminAuthState>((set) => ({
  token: localStorage.getItem("admin_token"),
  admin: null,

  setAuth: ({ token, admin }) => {
    localStorage.setItem("admin_token", token);

    set({
      token,
      admin,
    });
  },

  logout: () => {
    localStorage.removeItem("admin_token");

    set({
      token: null,
      admin: null,
    });
  },
}));
