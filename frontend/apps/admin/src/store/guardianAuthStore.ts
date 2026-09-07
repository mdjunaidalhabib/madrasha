import { create } from "zustand";
import { persist } from "zustand/middleware";

export type GuardianUser = {
  id: number;
  name: string | null;
  phone: string;
  mustChangePassword: boolean;
};

export type GuardianChild = {
  id: number;
  nameBn: string;
  roll: number | null;
  registrationNo: number;
  className: string | null;
  image: string | null;
};

export type GuardianAuthPayload = {
  token: string;
  guardian: GuardianUser;
};

type GuardianAuthState = {
  token: string | null;
  guardian: GuardianUser | null;
  children: GuardianChild[];
  selectedStudentId: number | null;
  setAuth: (data: GuardianAuthPayload) => void;
  setChildren: (children: GuardianChild[]) => void;
  selectStudent: (studentId: number) => void;
  markPasswordChanged: () => void;
  logout: () => void;
};

// Deliberately separate from useAuthStore (tenant admin) - a guardian and an
// admin could be logged in as different sessions in different tabs, and a
// guardian-side 401 must never clear/redirect the admin session or vice versa.
export const useGuardianAuthStore = create<GuardianAuthState>()(
  persist(
    (set) => ({
      token: null,
      guardian: null,
      children: [],
      selectedStudentId: null,

      setAuth: (data) => {
        set({ token: data.token, guardian: data.guardian });
      },

      setChildren: (children) => {
        set((state) => ({
          children,
          selectedStudentId:
            state.selectedStudentId && children.some((c) => c.id === state.selectedStudentId)
              ? state.selectedStudentId
              : children[0]?.id ?? null,
        }));
      },

      selectStudent: (studentId) => set({ selectedStudentId: studentId }),

      markPasswordChanged: () =>
        set((state) => ({
          guardian: state.guardian ? { ...state.guardian, mustChangePassword: false } : state.guardian,
        })),

      logout: () => {
        set({ token: null, guardian: null, children: [], selectedStudentId: null });
      },
    }),
    {
      name: "guardian-auth-storage",
      partialize: (state) => ({
        token: state.token,
        guardian: state.guardian,
        selectedStudentId: state.selectedStudentId,
      }),
    },
  ),
);
