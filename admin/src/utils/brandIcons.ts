import { setPwaManifest } from "@madrasha/shared-ui/src/pwa/pwa";
import { API_BASE_URL } from "@madrasha/shared-ui/src/services/apiConfig";
import { platformIconBase, type BrandIconSource } from "@madrasha/shared-ui/src/pwa/brandIcons";

/**
 * The admin panel's favicon, apple-touch-icon and PWA app icons are the logo the
 * SUPER ADMIN uploads under Super Admin -> Settings -> "Admin Panel Logo".
 *
 * - It is platform-wide and independent of every madrasa: a madrasa's own
 *   Branding Settings logo is never used here (and this never changes it).
 * - The backend renders the PNGs (GET /platform-brand/icon/<file>); this file
 *   only asks GET /platform-brand for the logo's current `version` and points
 *   the <link rel="icon"> tags and the runtime manifest at that versioned URL.
 *   Replacing the logo changes the version => favicon + PWA icons update;
 *   deleting it makes the version null => favicon and manifest icons go blank.
 * - No logo (or not known yet) => no icon at all. There is no default icon.
 */

const APP_NAME = "QMS — মাদ্রাসা ম্যানেজমেন্ট (Admin)";
const APP_SHORT_NAME = "QMS Admin";
const APP_DESCRIPTION = "কওমি মাদ্রাসার সম্পূর্ণ ডিজিটাল ম্যানেজমেন্ট সিস্টেম — Powered by Hikmah IT";

// Last version the server reported. Lets the very first paint (and the manifest
// the browser reads on load) already carry the right icon instead of flashing
// blank until /platform-brand answers. The server answer always wins.
const CACHE_KEY = "platform-brand-icon:v1";
const REFRESH_MS = 5 * 60 * 1000;

const readCache = (): string | null => {
  try {
    return localStorage.getItem(CACHE_KEY) || null;
  } catch {
    return null;
  }
};

const writeCache = (version: string | null) => {
  try {
    if (version) localStorage.setItem(CACHE_KEY, version);
    else localStorage.removeItem(CACHE_KEY);
  } catch {
    /* storage unavailable - icons still update, just without the head start */
  }
};

let applied = "\u0000";

function render(version: string | null) {
  const source: BrandIconSource | null = version ? { base: platformIconBase(), version } : null;
  const signature = source ? `${source.base}|${source.version}` : "";
  if (signature === applied) return;
  applied = signature;
  setPwaManifest({
    name: APP_NAME,
    shortName: APP_SHORT_NAME,
    description: APP_DESCRIPTION,
    startUrl: "/",
    icons: source,
    announceName: false,
  });
}

let inFlight = false;

/** Asks the server which logo version is current. A failed request (offline,
 * server down) is not authoritative, so it leaves whatever is showing alone. */
async function refresh() {
  if (inFlight) return;
  inFlight = true;
  try {
    const res = await fetch(`${API_BASE_URL}/platform-brand`, { cache: "no-store" });
    if (!res.ok) return;
    const body = await res.json();
    const version = typeof body?.data?.version === "string" && body.data.version ? body.data.version : null;
    writeCache(version);
    render(version);
  } catch {
    /* keep the current icon */
  } finally {
    inFlight = false;
  }
}

/** Call once at startup (before React renders). */
export function setupBrandIcons() {
  render(readCache());
  void refresh();

  // Pick up a logo the Super Admin changed or removed without needing a reload.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void refresh();
  });
  window.addEventListener("focus", () => void refresh());
  window.addEventListener("online", () => void refresh());
  window.setInterval(() => {
    if (document.visibilityState === "visible") void refresh();
  }, REFRESH_MS);
}
