import { useLayoutEffect } from "react";

/** Marketing pages always use light surfaces, including shared components. */
export function useLightLandingTheme() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    const previousScheme = root.style.colorScheme;
    root.classList.remove("dark");
    root.style.colorScheme = "light";
    return () => {
      root.classList.toggle("dark", wasDark);
      root.style.colorScheme = previousScheme;
    };
  }, []);
}
