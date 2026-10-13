/**
 * In-app navigation trail, shared by every app (admin / frontend / super-admin).
 *
 * React Router (data router) stamps every history entry with a numeric `idx`
 * in `window.history.state`. idx > 0 means there is an earlier entry that
 * belongs to THIS app's session. We additionally remember which path each idx
 * pointed at (sessionStorage - per tab/PWA window), so the Back button can
 * refuse to "go back" into a login screen or other auth page and fall back to
 * the dashboard instead.
 *
 * The browser's own Back / Alt+Left / Android system Back all just pop the same
 * history stack, so the in-app Back button stays consistent with them.
 */

const TRAIL_KEY = "qms:nav-trail";

type Trail = Record<string, string>;

const AUTH_PATH = /(^|\/)(login|forgot-password|reset-password|change-password)(\/|\?|#|$)/;

export const isAuthPath = (path: string) => AUTH_PATH.test(path);

const readTrail = (): Trail => {
  try {
    return JSON.parse(sessionStorage.getItem(TRAIL_KEY) || "{}") as Trail;
  } catch {
    return {};
  }
};

const writeTrail = (trail: Trail) => {
  try {
    sessionStorage.setItem(TRAIL_KEY, JSON.stringify(trail));
  } catch {
    /* storage unavailable (private mode / quota) - Back still works via idx */
  }
};

export const currentHistoryIndex = (): number => {
  const idx = (window.history.state as { idx?: unknown } | null)?.idx;
  return typeof idx === "number" ? idx : 0;
};

/** Called on every location change. Entries after the current one are stale. */
export function recordLocation(path: string) {
  const idx = currentHistoryIndex();
  const trail = readTrail();
  trail[String(idx)] = path;
  for (const key of Object.keys(trail)) {
    if (Number(key) > idx) delete trail[key];
  }
  writeTrail(trail);
}

/** The path of the previous in-app entry, or null if there is none. */
export function previousInAppPath(): string | null {
  const idx = currentHistoryIndex();
  if (idx <= 0) return null;
  return readTrail()[String(idx - 1)] ?? null;
}

/** True when going back (-1) would stay inside the app and not hit an auth page. */
export function canGoBackInApp(): boolean {
  const prev = previousInAppPath();
  // idx > 0 but unknown path (e.g. trail lost): trust the history stack.
  if (prev === null) return currentHistoryIndex() > 0;
  return !isAuthPath(prev);
}
