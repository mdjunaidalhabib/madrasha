import { setPwaManifest, setStaticPwaIcon } from "@madrasha/shared-ui/src/pwa/pwa";
import { logoVersion, tenantIconBase, type BrandIconSource } from "@madrasha/shared-ui/src/pwa/brandIcons";
import { getResolvedDomainSlugSync } from "../services/domainResolve";
import { isPlatformRootHost } from "./platformHost";
import { getText } from "@madrasha/shared-ui/src/i18n";
import { appText } from "../app/app.text";

const RESERVED = new Set(["", "admin", "api", "assets", "login", "super-admin", "guardian", "admission", "contact"]);

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

// The madrasa's logo-derived icons. null = no logo (or not known yet) - the
// favicon / manifest icons then stay empty; there is no platform fallback.
let currentIcons: BrandIconSource | null = null;

// Remembers each madrasa's last logo fingerprint so pages that never load the
// website payload (guardian portal, a reload straight onto /admission) still
// get the right icon from the first paint.
const cacheKey = (slug: string) => `brand-icon:${slug}`;
const readCachedVersion = (slug: string) => {
  try {
    return localStorage.getItem(cacheKey(slug));
  } catch {
    return null;
  }
};
const writeCachedVersion = (slug: string, version: string | null) => {
  try {
    if (version) localStorage.setItem(cacheKey(slug), version);
    else localStorage.removeItem(cacheKey(slug));
  } catch {
    /* storage unavailable - icons just lose the first-paint head start */
  }
};

const slugFromStartUrl = (startUrl: string) => startUrl.split("/").filter(Boolean).pop() || "";

/** Call as soon as the madrasa's name is known to label the installed app with it. */
export function setTenantManifestName(name?: string | null) {
  if (!name || name === currentName) return;
  currentName = name;
  setupTenantManifest();
}

/**
 * Call once the madrasa's public data is loaded: its name AND its logo (the
 * logo from Branding Settings becomes the favicon + PWA icon). Pass a falsy
 * `logo` when the madrasa has none - the icons are then cleared.
 */
export function setTenantBrand({ name, slug, logo }: { name?: string | null; slug?: string | null; logo?: string | null }) {
  if (name) currentName = name;
  if (slug) {
    const version = logo ? logoVersion(logo) : null;
    currentIcons = version ? { base: tenantIconBase(slug), version } : null;
    writeCachedVersion(slug, version);
  }
  setupTenantManifest();
}

/** The platform's own landing page keeps the platform's static manifest/icons;
 * those are not a madrasa default and never appear on a madrasa's pages. */
function applyPlatformIcons() {
  document
    .querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')
    .forEach((el) => el.remove());
  const add = (rel: string, href: string, extra: Record<string, string> = {}) => {
    const link = document.createElement("link");
    link.rel = rel;
    Object.entries(extra).forEach(([k, v]) => link.setAttribute(k, v));
    link.href = href;
    document.head.appendChild(link);
  };
  add("icon", "/icons/favicon-32.png", { type: "image/png", sizes: "32x32" });
  add("apple-touch-icon", "/icons/apple-touch-icon.png");
  setStaticPwaIcon("/icons/icon-192.png");
}

export function setupTenantManifest() {
  const startUrl = getTenantStartUrl();
  // Platform landing page itself - keep the static manifest.
  if (startUrl === "/" && isPlatformRootHost()) {
    applyPlatformIcons();
    return;
  }

  if (!currentIcons) {
    const slug = slugFromStartUrl(startUrl) || getResolvedDomainSlugSync();
    const version = slug ? readCachedVersion(slug) : null;
    if (slug && version) currentIcons = { base: tenantIconBase(slug), version };
  }

  const text = getText(appText);
  const name = currentName || text.appName;
  setPwaManifest({ name, startUrl, description: text.pwaDescription(name), icons: currentIcons });
}
