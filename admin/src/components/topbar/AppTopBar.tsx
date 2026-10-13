import { useEffect, useState } from "react";
import GlobalBackButton from "@madrasha/shared-ui/src/navigation/GlobalBackButton";
import GlobalRefreshButton from "@madrasha/shared-ui/src/navigation/GlobalRefreshButton";
import { useIsStandalone } from "../../hooks/useIsStandalone";

/** Mouse + hover = a desktop window; touch phones/tablets report "coarse". */
const DESKTOP_QUERY = "(hover: hover) and (pointer: fine)";

function useIsDesktopPointer(): boolean {
  const [desktop, setDesktop] = useState(() => !!window.matchMedia?.(DESKTOP_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(DESKTOP_QUERY);
    if (!mq) return;
    const update = () => setDesktop(mq.matches);
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return desktop;
}

/**
 * Back + Refresh for the INSTALLED MOBILE/TABLET app only.
 *
 * Installed desktop Chrome already draws Back and Reload in its own title bar,
 * right after the app icon (like YouTube), so we render nothing there - no
 * second bar. A browser tab has its own buttons too, so nothing there either.
 * Phones have neither, so they get a slim green bar with the two buttons.
 */
export default function AppTopBar() {
  const standalone = useIsStandalone();
  const desktop = useIsDesktopPointer();
  if (!standalone || desktop) return null;

  const ghost = "!rounded-md !border-transparent !bg-transparent !text-white hover:!bg-white/20";

  return (
    <div
      className="flex w-full shrink-0 select-none items-center gap-1 bg-emerald-600 px-2 text-white print:hidden"
      style={{ height: "36px", paddingTop: "env(safe-area-inset-top, 0px)", boxSizing: "content-box" }}
    >
      <GlobalBackButton fallbackPath="/dashboard" size="sm" className={ghost} />
      <GlobalRefreshButton size="sm" className={ghost} />
    </div>
  );
}
