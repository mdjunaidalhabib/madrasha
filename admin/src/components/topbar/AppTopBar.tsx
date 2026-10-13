import GlobalBackButton from "@madrasha/shared-ui/src/navigation/GlobalBackButton";
import GlobalRefreshButton from "@madrasha/shared-ui/src/navigation/GlobalRefreshButton";
import { useIsStandalone } from "../../hooks/useIsStandalone";
import { useWindowControlsOverlay } from "../../hooks/useWindowControlsOverlay";

/**
 * Back + Refresh for the INSTALLED app only (a browser tab has its own).
 *
 * Desktop installed app: the buttons live INSIDE the green title bar (Window
 * Controls Overlay), on the left next to the app icon - no extra bar at all.
 * The bar is draggable; only the buttons are clickable.
 *
 * Fallback (mobile installed app / browser without the overlay): a slim green
 * bar at the very top, same look, so the buttons still have a home.
 */
export default function AppTopBar() {
  const standalone = useIsStandalone();
  const overlay = useWindowControlsOverlay();
  if (!standalone) return null;

  // titlebar-area-* keep content clear of the OS window buttons (min/max/close).
  const style = overlay
    ? ({
        height: "env(titlebar-area-height, 40px)",
        paddingLeft: "max(env(titlebar-area-x, 0px), 8px)",
        paddingRight: "calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw) + 8px)",
        WebkitAppRegion: "drag",
        appRegion: "drag",
      } as React.CSSProperties)
    : ({
        height: "40px",
        paddingTop: "env(safe-area-inset-top, 0px)",
        boxSizing: "content-box",
      } as React.CSSProperties);

  const noDrag = { WebkitAppRegion: "no-drag", appRegion: "no-drag" } as React.CSSProperties;

  return (
    <div
      className="flex w-full shrink-0 select-none items-center gap-2 bg-emerald-600 px-3 text-white print:hidden"
      style={style}
    >
      <div className="flex items-center gap-2" style={noDrag}>
        <GlobalBackButton fallbackPath="/dashboard" size="sm" className="!border-white/30 !bg-white/15 !text-white hover:!bg-white/25" />
        <GlobalRefreshButton size="sm" className="!border-white/30 !bg-white/15 !text-white hover:!bg-white/25" />
      </div>
      {overlay && <span className="truncate text-xs font-medium opacity-90">QMS Admin</span>}
    </div>
  );
}
