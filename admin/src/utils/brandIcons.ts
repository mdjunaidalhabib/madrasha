import { setPwaManifest } from "@madrasha/shared-ui/src/pwa/pwa";
import { logoVersion, tenantIconBase, type BrandIconSource } from "@madrasha/shared-ui/src/pwa/brandIcons";
import { useAuthStore } from "../store/authStore";
import { useBrandingStore } from "../store/brandingStore";

/**
 * The admin panel runs on ONE origin for every madrasa, so its favicon and
 * PWA icons can't be static files: they are the logo the logged-in madrasa
 * saved in Branding Settings, rendered by the backend. Changing or deleting
 * that logo flows through brandingStore, so everything here updates with it.
 *
 * No logo (or not logged in) => no favicon / manifest icons - never a default.
 */

const APP_NAME = "QMS — মাদ্রাসা ম্যানেজমেন্ট (Admin)";
const APP_SHORT_NAME = "QMS Admin";
const APP_DESCRIPTION = "কওমি মাদ্রাসার সম্পূর্ণ ডিজিটাল ম্যানেজমেন্ট সিস্টেম — Powered by Hikmah IT";

// Last logo fingerprint seen for the session's madrasa. Lets the very first
// paint (and the PWA manifest the browser reads on load) already carry the right
// icon, instead of flashing blank until /settings/branding answers.
const CACHE_KEY = "brand-icon:v1";

type Cached = { slug: string; version: string };

const readCache = (): Cached | null => {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    return raw && typeof raw.slug === "string" && typeof raw.version === "string" ? raw : null;
  } catch {
    return null;
  }
};

const writeCache = (value: Cached | null) => {
  try {
    if (value) localStorage.setItem(CACHE_KEY, JSON.stringify(value));
    else localStorage.removeItem(CACHE_KEY);
  } catch {
    /* storage unavailable - icons still update, just without the head start */
  }
};

let applied = "\u0000";

function render(source: BrandIconSource | null) {
  const signature = source ? `${source.base}|${source.version}` : "";
  if (signature === applied) return;
  applied = signature;
  setPwaManifest({
    name: APP_NAME,
    shortName: APP_SHORT_NAME,
    description: APP_DESCRIPTION,
    startUrl: "/",
    icons: source,
    announceName: false,
  });
}

function sync() {
  const slug = useAuthStore.getState().madrasaSlug;

  // Logged out: nothing belongs to any madrasa.
  if (!slug) {
    writeCache(null);
    render(null);
    return;
  }

  const branding = useBrandingStore.getState().branding;

  // Branding not loaded yet (or the fetch failed): not authoritative, so keep
  // whatever this madrasa's last known logo produced rather than blanking.
  if (!branding) {
    const cached = readCache();
    render(cached && cached.slug === slug ? { base: tenantIconBase(slug), version: cached.version } : null);
    return;
  }

  const logo = branding.report_logo;
  if (!logo) {
    writeCache(null);
    render(null);
    return;
  }

  const version = logoVersion(logo);
  writeCache({ slug, version });
  render({ base: tenantIconBase(slug), version });
}

/** Call once at startup (before React renders). */
export function setupBrandIcons() {
  sync();
  useAuthStore.subscribe(sync);
  useBrandingStore.subscribe(sync);
}
