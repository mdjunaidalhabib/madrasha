import { setPwaManifest } from "@madrasha/shared-ui/src/pwa/pwa";
import { isPlatformRootHost } from "./platformHost";

const RESERVED = new Set(["", "admin", "api", "assets", "login", "super-admin", "guardian", "kiosk", "admission", "contact"]);

/**
 * Where the installed app should open for the madrasa being visited:
 * "/m/<slug>" or "/<slug>" on the platform domain, "/" on a custom domain.
 * Without this the static manifest's start_url "/" would open the platform's
 * landing page instead of the madrasa the visitor installed it from.
 */
export function getTenantStartUrl(pathname = window.location.pathname) {
  if (!isPlatformRootHost()) return "/";
  const [first = "", second = ""] = pathname.split("/").filter(Boolean);
  if (first === "m" && second) return `/m/${second}`;
  return RESERVED.has(first) ? "/" : `/${first}`;
}

let currentName = "মাদ্রাসা";

/** Call as soon as the madrasa's name is known to label the installed app with it. */
export function setTenantManifestName(name?: string | null) {
  if (!name || name === currentName) return;
  currentName = name;
  setupTenantManifest();
}

export function setupTenantManifest() {
  const startUrl = getTenantStartUrl();
  // Platform landing page itself - keep the static manifest.
  if (startUrl === "/" && isPlatformRootHost()) return;
  setPwaManifest({ name: currentName, startUrl, description: `${currentName} — ওয়েবসাইট ও অভিভাবক পোর্টাল` });
}
