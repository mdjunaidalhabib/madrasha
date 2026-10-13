import { useRef } from "react";
import { RefreshCw } from "lucide-react";
import { useText } from "../i18n";
import { navText } from "./nav.text";
import { requestFullReload, requestRefresh, useRefreshStore } from "./refreshStore";

const LONG_PRESS_MS = 700;

/**
 * One Refresh button for the whole app.
 * Click = soft refresh (re-fetch current page data, session untouched).
 * Shift+click or long-press = full page reload (the only option in an
 * installed PWA, which has no browser reload button).
 */
export default function GlobalRefreshButton({
  className = "",
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md";
}) {
  const t = useText(navText);
  const refreshing = useRefreshStore((s) => s.refreshing);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  const clearTimer = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    longPressed.current = false;
    if (e.pointerType === "mouse") return; // mouse users have Shift+click
    clearTimer();
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      void requestFullReload();
    }, LONG_PRESS_MS);
  };

  const onClick = (e: React.MouseEvent) => {
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    if (refreshing) return;
    if (e.shiftKey) void requestFullReload();
    else void requestRefresh();
  };

  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={clearTimer}
      onPointerLeave={clearTimer}
      onPointerCancel={clearTimer}
      onContextMenu={(e) => e.preventDefault()}
      disabled={refreshing}
      aria-busy={refreshing}
      aria-label={refreshing ? t.refreshing : t.refresh}
      title={refreshing ? t.refreshing : `${t.refresh} — ${t.refreshHint}`}
      className={`flex ${size === "sm" ? "h-8 w-8" : "h-9 w-9"} shrink-0 select-none items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-95 disabled:cursor-wait disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 ${className}`}
    >
      <RefreshCw size={size === "sm" ? 15 : 17} className={refreshing ? "animate-spin" : ""} />
    </button>
  );
}
