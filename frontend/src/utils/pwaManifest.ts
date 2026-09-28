import { setPwaManifest } from "@madrasha/shared-ui/src/pwa/pwa";
import { isPlatformRootHost } from "./platformHost";
import { getText } from "@madrasha/shared-ui/src/i18n";
import { appText } from "../app/app.text";

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

// null until the tenant's own name is known - then the translated
// institution word ("মাদ্রাসা" / "School" ...) stands in.
let currentName: string | null = null;

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
  const text = getText(appText);
  const name = currentName || text.appName;
  setPwaManifest({ name, startUrl, description: text.pwaDescription(name) });
}
