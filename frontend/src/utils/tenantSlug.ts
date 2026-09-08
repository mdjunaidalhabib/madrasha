import { getResolvedDomainSlugSync } from "../services/domainResolve";
import { isPlatformRootHost } from "./platformHost";

// "guardian"/"kiosk"/"admission" are also the bare (no-slug) route prefixes
// used on a tenant's custom domain (see CustomDomainTenantGate) - reserved
// here too so a custom-domain URL's first segment is never mistaken for a
// slug.
const RESERVED_ROOT_PATHS = new Set([
  "",
  "admin",
  "api",
  "assets",
  "login",
  "m",
  "super-admin",
  "guardian",
  "kiosk",
  "admission",
]);

export function getTenantSlugFromPath(pathname = window.location.pathname) {
  const firstSegment = pathname.split("/").filter(Boolean)[0] || "";
  if (!RESERVED_ROOT_PATHS.has(firstSegment)) return firstSegment;
  // On the platform's own domain a reserved-looking first segment really
  // does mean "no slug here" (e.g. "/login"). On a tenant's custom domain
  // there's never a slug in the URL at all - fall back to the slug already
  // resolved from the hostname (see CustomDomainTenantGate/RootRoute, which
  // both resolve it before rendering anything that calls this).
  return isPlatformRootHost() ? "" : getResolvedDomainSlugSync();
}

export function getTenantGuardianBase(slug = getTenantSlugFromPath()) {
  if (!isPlatformRootHost()) return "/guardian";
  return slug ? `/${slug}/guardian` : "/demo-madrasa/guardian";
}
