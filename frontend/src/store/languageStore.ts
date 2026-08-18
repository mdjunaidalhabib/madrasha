import { create } from "zustand";

export type Lang = "bn" | "en" | "ar";

const STORAGE_KEY = "app-language";

function getInitialLang(): Lang {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "bn" || stored === "en" || stored === "ar") return stored;
  return "bn";
}

type LanguageState = {
  lang: Lang;
  setLang: (lang: Lang) => void;
};

export const useLanguageStore = create<LanguageState>((set) => ({
  lang: getInitialLang(),

  setLang: (lang) => {
    localStorage.setItem(STORAGE_KEY, lang);
    set({ lang });
  },
}));
