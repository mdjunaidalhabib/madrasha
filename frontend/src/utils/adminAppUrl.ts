// The tenant admin dashboard (madrasa staff login) lives in the separate
// "admin" app (its own origin) - see ARCHITECTURE.md. The landing page's
// "অ্যাডমিন প্যানেলে যান" nav button links there. Admin login is fixed at
// "/login" (not slug-based - the madrasa code is entered on the login form
// itself), so no tenant slug is needed here, unlike getPublicSiteUrl on the
// admin side.
const ADMIN_APP_URL = (import.meta.env.VITE_ADMIN_APP_URL as string | undefined) || "";

export function getAdminAppLoginUrl() {
  return `${ADMIN_APP_URL}/login`;
}
