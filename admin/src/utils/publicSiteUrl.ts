// The public madrasa website, admission form, guardian portal, and
// attendance kiosk moved out of this app into the separate "frontend" app
// (its own domain) - see ARCHITECTURE.md. Links this app builds to those
// pages (dashboard's "view public website" card, the website builder's
// preview link, the kiosk device setup page) must point at that app's
// origin, not this app's own window.location.origin.
//
// Named VITE_PUBLIC_SITE_URL (not VITE_FRONTEND_*) on purpose - the backend
// already has an unrelated FRONTEND_BASE_URL env var that points at THIS
// app (admin), so reusing "frontend" here would read as the same thing.
const PUBLIC_SITE_URL = (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined) || "";

export function getPublicSiteUrl(slug: string) {
  return `${PUBLIC_SITE_URL}/${slug}`;
}

export function getPublicSiteKioskUrl(slug: string) {
  return `${PUBLIC_SITE_URL}/${slug}/kiosk`;
}
