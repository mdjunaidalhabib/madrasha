import GlobalBackButton from "@madrasha/shared-ui/src/navigation/GlobalBackButton";
import GlobalRefreshButton from "@madrasha/shared-ui/src/navigation/GlobalRefreshButton";
import { useIsStandalone } from "../../hooks/useIsStandalone";

/**
 * Slim bar pinned at the very top of the INSTALLED app (YouTube-style):
 * Back on the left, Refresh on the right. An installed app has no browser
 * chrome, so these two buttons are its only navigation controls.
 *
 * In a normal browser tab this renders nothing at all - the browser already has
 * its own Back / Reload, so the bar (and its buttons) must not exist there.
 */
export default function AppTopBar() {
  const standalone = useIsStandalone();
  if (!standalone) return null;

  return (
    <div
      className="flex h-11 w-full shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900 print:hidden"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)", boxSizing: "content-box" }}
    >
      <GlobalBackButton fallbackPath="/dashboard" size="sm" />
      <GlobalRefreshButton size="sm" />
    </div>
  );
}
