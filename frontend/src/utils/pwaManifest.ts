import { disablePwaInstall, setPwaManifest } from "@madrasha/shared-ui/src/pwa/pwa";
import { applyBrandFavicon, logoVersion, platformIconBase, tenantIconBase } from "@madrasha/shared-ui/src/pwa/brandIcons";
import { API_BASE_URL } from "@madrasha/shared-ui/src/services/apiConfig";
import { resolveDomainToSlug } from "../services/domainResolve";
import { getPublicWebsite } from "../services/publicWebsiteApi";
import { isPlatformRootHost } from "./platformHost";
import { getText } from "@madrasha/shared-ui/src/i18n";
import { appText } from "../app/app.text";

const RESERVED = new Set(["", "m", "demo", "admin", "api", "assets", "login", "super-admin", "guardian", "admission", "contact"]);

/** Both public URL aliases identify the same installed institution app. */
export function getTenantStartUrl(pathname = window.location.pathname) {
  if (!isPlatformRootHost()) return "/";
  const [first = "", second = ""] = pathname.split("/").filter(Boolean);
  const slug = first === "m" ? second : first;
  return RESERVED.has(slug) ? "/" : `/${slug}/`;
}

let activeSlug: string | null = null;
let routeVersion = 0;
let lastPathname = "";
let brandRequest = 0;

/** Apply only the brand belonging to the current route; ignore late responses. */
export function setTenantBrand({ name, slug, logo }: { name?: string | null; slug?: string | null; logo?: string | null }) {
  if (!slug || slug !== activeSlug) return;
  const icons = logo ? { base: tenantIconBase(slug), version: logoVersion(logo) } : null;
  applyBrandFavicon(icons);
  if (!name || !icons) {
    disablePwaInstall();
    return;
  }

  const startUrl = isPlatformRootHost() ? `/${encodeURIComponent(slug)}/` : "/";
  setPwaManifest({
    name,
    shortName: name,
    // Stable across /m/:slug, /:slug and guardian/admission pages.
    id: `/${encodeURIComponent(slug)}`,
    startUrl,
    // The trailing slash keeps similarly named institutions outside this app.
    scope: startUrl,
    description: getText(appText).pwaDescription(name),
    icons,
  });
}

async function applyPlatformIcons(version: number) {
  applyBrandFavicon(null);
  try {
    const response = await fetch(`${API_BASE_URL}/platform-brand`, { cache: "no-store" });
    if (!response.ok) return;
    const body = await response.json();
    // A late platform response must never overwrite an institution's own icon.
    if (version !== routeVersion) return;
    const logoVersion = body?.data?.version;
    applyBrandFavicon(typeof logoVersion === "string" && logoVersion
      ? { base: platformIconBase(), version: logoVersion }
      : null);
  } catch {
    // Leave the icon blank until the platform's saved logo can be verified.
  }
  // Marketing pages use the saved platform favicon without enabling PWA install.
}

/** Runs before React and on navigation, including direct guardian portal visits. */
export async function setupTenantManifest(pathname = window.location.pathname) {
  if (pathname === lastPathname) return;
  lastPathname = pathname;
  const version = ++routeVersion;
  const platform = isPlatformRootHost();
  const startUrl = getTenantStartUrl(pathname);

  if (platform && startUrl === "/") {
    brandRequest++;
    activeSlug = null;
    disablePwaInstall();
    await applyPlatformIcons(version);
    return;
  }

  // Custom hosts cannot install anything until domain resolution succeeds.
  if (!platform && activeSlug === null) {
    disablePwaInstall();
    applyBrandFavicon(null);
  }
  const slug = platform ? decodeURIComponent(startUrl.split("/")[1]) : await resolveDomainToSlug();
  if (version !== routeVersion) return;
  if (slug === activeSlug) return;
  activeSlug = slug;
  const request = ++brandRequest;
  disablePwaInstall();
  applyBrandFavicon(null);
  if (!slug) return;

  try {
    const data = await getPublicWebsite(slug);
    if (activeSlug !== slug || request !== brandRequest) return;
    const madrasa = data?.madrasa;
    if (madrasa?.slug === slug) {
      setTenantBrand({ name: madrasa.name, slug, logo: madrasa.logo_url });
    }
  } catch {
    // Failed, unavailable or unknown institutions must not offer a generic app.
  }
}
