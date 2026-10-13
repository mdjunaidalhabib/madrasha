import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useText } from "../i18n";
import { navText } from "./nav.text";
import { canGoBackInApp } from "./navHistory";

type Props = {
  /** The app's dashboard - used when there is no earlier in-app page. */
  fallbackPath: string;
  className?: string;
  /** "sm" fits the compact top bars (32px), "md" is the default (36px). */
  size?: "sm" | "md";
};

const stripTrailingSlash = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);

/**
 * One Back button for the whole app. Goes to the previous router entry when it
 * exists inside this app; otherwise (direct URL, bookmark, fresh PWA launch,
 * previous page was a login screen) it replaces the current entry with the
 * dashboard. Hidden only when already on the dashboard with nothing to go back to.
 * A dirty form is protected by NavigationController's blocker.
 */
export default function GlobalBackButton({ fallbackPath, className = "", size = "md" }: Props) {
  const t = useText(navText);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const hasHistory = canGoBackInApp();
  const onFallback = stripTrailingSlash(pathname) === stripTrailingSlash(fallbackPath);
  if (!hasHistory && onFallback) return null;

  const handleClick = () => {
    if (canGoBackInApp()) navigate(-1);
    else navigate(fallbackPath, { replace: true });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={t.back}
      aria-label={t.back}
      className={`flex ${size === "sm" ? "h-8 w-8" : "h-9 w-9"} shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-95 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 ${className}`}
    >
      <ArrowLeft size={size === "sm" ? 16 : 18} className="rtl:rotate-180" />
    </button>
  );
}
