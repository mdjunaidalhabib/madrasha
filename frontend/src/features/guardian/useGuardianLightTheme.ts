import { useLayoutEffect } from "react";

// Guardian pages use a light palette, including their shared UI components.
// Preserve the saved theme and restore the document theme when leaving.
export function useGuardianLightTheme() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    const previousColorScheme = root.style.colorScheme;
    root.classList.remove("dark");
    root.style.colorScheme = "light";
    return () => {
      root.classList.toggle("dark", wasDark);
      root.style.colorScheme = previousColorScheme;
    };
  }, []);
}
