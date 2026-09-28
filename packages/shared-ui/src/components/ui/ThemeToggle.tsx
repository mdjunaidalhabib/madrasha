import { Moon, Sun } from "lucide-react";
import { useThemeStore } from "../../store/themeStore";
import { useText } from "../../i18n";
import { uiText } from "./ui.text";

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const isDark = theme === "dark";
  const t = useText(uiText);

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? t.enableLight : t.enableDark}
      title={isDark ? t.lightMode : t.darkMode}
      className={[
        "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100",
        "dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
        className,
      ].join(" ")}
    >
      {isDark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
