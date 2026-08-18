import { useEffect } from "react";
import { useThemeStore } from "../store/themeStore";

// লগইন পেজ সবসময় লাইট থিমে দেখাতে হবে (নাইট মোড অন থাকলেও)। localStorage-এর
// থিম প্রেফারেন্স স্পর্শ করা হয় না, তাই পেজ ছেড়ে গেলে ইউজারের আসল পছন্দ
// (ডার্ক/লাইট) স্বয়ংক্রিয়ভাবে ফিরে আসে।
export function useForceLightTheme() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark");

    return () => {
      if (useThemeStore.getState().theme === "dark") root.classList.add("dark");
    };
  }, []);
}
