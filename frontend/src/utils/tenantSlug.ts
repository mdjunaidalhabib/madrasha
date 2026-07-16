const RESERVED_ROOT_PATHS = new Set(["", "admin", "api", "assets", "login", "m", "super-admin"]);

export function getTenantSlugFromPath(pathname = window.location.pathname) {
  const firstSegment = pathname.split("/").filter(Boolean)[0] || "";
  if (RESERVED_ROOT_PATHS.has(firstSegment)) return "";
  return firstSegment;
}

export function getTenantAdminBase(slug = getTenantSlugFromPath()) {
  return slug ? `/${slug}/admin` : "/demo-madrasa/admin";
}
