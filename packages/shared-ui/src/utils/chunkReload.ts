import { logger } from "./logger";

const RELOAD_GUARD_KEY = "madrasha:chunk-reload-at";
const RELOAD_GUARD_WINDOW_MS = 10_000;

/**
 * After a new deploy, a browser tab left open from before still points at the
 * old chunk-hash manifest. Clicking a lazy route (React.lazy/dynamic import)
 * whose file was renamed/removed by the new build then fails to fetch, and
 * with no recovery it's stuck on that one page's RouteErrorBoundary forever -
 * every *other* already-loaded chunk keeps working, so only that one page
 * looks "broken". Vite fires `vite:preloadError` on `window` for exactly this
 * case; a single full reload picks up the fresh index.html/manifest and the
 * page loads normally. Guarded by sessionStorage so a genuinely offline/broken
 * chunk reloads once instead of looping forever.
 */
export function setupChunkReloadOnPreloadError() {
  window.addEventListener("vite:preloadError", (event) => {
    logger.error("Chunk preload failed, reloading", event);

    const lastReloadAt = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
    if (Date.now() - lastReloadAt < RELOAD_GUARD_WINDOW_MS) return;

    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
    event.preventDefault();
    window.location.reload();
  });
}
