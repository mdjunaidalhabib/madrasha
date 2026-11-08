import { disablePwaInstall, setPwaManifest } from "@madrasha/shared-ui/src/pwa/pwa";
import { applyBrandFavicon, logoVersion, tenantIconBase } from "@madrasha/shared-ui/src/pwa/brandIcons";
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

function applyPlatformIcons() {
  applyBrandFavicon(null);
  const link = document.createElement("link");
  link.rel = "icon";
  link.href = "/icons/favicon-32.png";
  document.head.appendChild(link);
  // No apple-touch-icon or manifest on the EMS marketing pages.
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
    applyPlatformIcons();
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
