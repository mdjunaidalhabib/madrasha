import { API_BASE_URL } from "../services/apiConfig";

/**
 * A madrasa's favicon + PWA icons are rendered by the backend from the logo
 * set in Branding Settings (GET /website/public/:slug/icon/<file>, public).
 * There is deliberately NO platform fallback: no logo => no icons at all.
 */
export interface BrandIconSource {
  /** `${API}/website/public/<slug>/icon` - no trailing slash. */
  base: string;
  /** Cache-buster derived from the logo, see logoVersion(). */
  version: string;
}

export const tenantIconBase = (slug: string) => `${API_BASE_URL}/website/public/${encodeURIComponent(slug)}/icon`;

/** The MAIN ADMIN PANEL's own icons: rendered from the logo the Super Admin set
 * in Settings (GET /platform-brand/icon/<file>, public). Unrelated to any
 * madrasa's logo; no logo => 404 => no icon. */
export const platformIconBase = () => `${API_BASE_URL}/platform-brand/icon`;

/** Short, stable fingerprint of the logo value (data URI / URL). A changed
 * logo => a new URL => browsers refetch the favicon and the PWA icons. */
export function logoVersion(logo: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < logo.length; i++) {
    h ^= logo.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export const brandIconUrl = (src: BrandIconSource, file: string) =>
  `${src.base}/${file}?v=${encodeURIComponent(src.version)}`;

/** Icons for a web app manifest (all absolute - a data: manifest has no base). */
export function brandManifestIcons(src: BrandIconSource | null) {
  if (!src) return [];
  return [
    { src: brandIconUrl(src, "icon-192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
    { src: brandIconUrl(src, "icon-512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
    { src: brandIconUrl(src, "maskable-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
  ];
}

/**
 * (Re)writes the page's <link rel="icon"> and apple-touch-icon.
 * With no source the favicon is explicitly blank (`data:,`) - that also stops
 * the browser from falling back to requesting /favicon.ico.
 * Old links are removed and fresh ones appended: swapping the element is the
 * only way every browser reliably re-reads a changed favicon.
 */
export function applyBrandFavicon(src: BrandIconSource | null) {
  if (typeof document === "undefined") return;
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

  if (!src) {
    add("icon", "data:,");
    return;
  }
  add("icon", brandIconUrl(src, "favicon-32.png"), { type: "image/png", sizes: "32x32" });
  add("apple-touch-icon", brandIconUrl(src, "apple-touch-icon.png"), { sizes: "180x180" });
}
