// The platform's own domain (where the landing/marketing page lives) - any
// other hostname this app is served from is treated as a tenant's connected
// custom domain. Dev/local hosts are always treated as the platform root so
// local development is unaffected by this env var being unset.
export const PLATFORM_ROOT_HOST = import.meta.env.VITE_PLATFORM_ROOT_HOST || "";

const DEV_HOSTS = new Set(["localhost", "127.0.0.1"]);

export function isPlatformRootHost(hostname = window.location.hostname) {
  if (DEV_HOSTS.has(hostname)) return true;
  if (!PLATFORM_ROOT_HOST) return true;
  return hostname === PLATFORM_ROOT_HOST;
}
