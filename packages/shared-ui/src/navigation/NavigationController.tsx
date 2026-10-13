import { useEffect } from "react";
import { useBlocker, useLocation } from "react-router-dom";
import { recordLocation } from "./navHistory";
import { confirmDiscardIfDirty, hasUnsavedChanges, shouldWarnOnUnload } from "./unsavedChanges";

/**
 * Mount ONCE inside each app's shell layout (it needs the router context).
 *  1. Records the in-app navigation trail used by the global Back button.
 *  2. Warns before browser close / F5 / Ctrl+R when a form has unsaved input
 *     (a plain `beforeunload` listener - it never intercepts the shortcuts, so
 *     Alt+Left, Ctrl+R and the browser's own buttons behave natively).
 *  3. Warns before any in-app route change away from a dirty form (menu,
 *     Back button, browser Back, Android system Back).
 */
export default function NavigationController() {
  const location = useLocation();

  useEffect(() => {
    recordLocation(location.pathname + location.search);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!shouldWarnOnUnload()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedChanges() && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    let cancelled = false;
    confirmDiscardIfDirty().then((ok) => {
      if (cancelled) return;
      if (ok) blocker.proceed();
      else blocker.reset();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocker.state]);

  return null;
}
