import { setupPlatformBrandIcons } from "@madrasha/shared-ui/src/pwa/platformBrand";
import {
  applyBrandFavicon,
  logoVersion,
  tenantIconBase,
} from "@madrasha/shared-ui/src/pwa/brandIcons";
import { setPwaManifest } from "@madrasha/shared-ui/src/pwa/pwa";
import type { AdminDomain } from "../store/adminDomainStore";
import { useBrandingStore } from "../store/brandingStore";
import { useAuthStore } from "../store/authStore";

const APP_SHORT_NAME = "EMS Admin";
const APP_DESCRIPTION =
  "মাদ্রাসা, স্কুল, কলেজ ও কিন্ডারগার্টেনের সম্পূর্ণ ডিজিটাল ম্যানেজমেন্ট সিস্টেম — Powered by Hikmah IT";

export function setupBrandIcons(institution: AdminDomain | null) {
  const render = (slug: string, name: string, logo: string | null) => {
    document.title = name;
    const icons = logo ? { base: tenantIconBase(slug), version: logoVersion(logo) } : null;
    applyBrandFavicon(icons);
    document
      .querySelectorAll<HTMLMetaElement>(
        'meta[property="og:site_name"], meta[property="og:title"], meta[property="og:description"], meta[property="og:image"], meta[property="og:image:alt"], meta[name="twitter:title"], meta[name="twitter:description"], meta[name="twitter:image"], meta[name="twitter:image:alt"], meta[name="description"]',
      )
      .forEach((meta) => {
        const key = meta.getAttribute("property") || meta.name;
        meta.content = key.endsWith("image")
          ? logo || ""
          : key.endsWith("url")
            ? window.location.origin
            : name;
      });
    setPwaManifest({
      name,
      shortName: name,
      description: name,
      startUrl: "/",
      scope: "/",
      icons,
    });
  };
  if (institution) {
    render(institution.slug, institution.name, institution.logo);
    // Keep the browser/PWA branding current after Branding Settings are saved.
    useBrandingStore.subscribe((state) => {
      if (state.branding)
        render(
          institution.slug,
          state.branding.name || institution.name,
          state.branding.report_logo || null,
        );
    });
    return;
  }
  const tenantSlug = () => {
    const auth = useAuthStore.getState();
    return auth.token ? auth.madrasaSlug : null;
  };
  const refreshPlatform = setupPlatformBrandIcons({
    // Desktop uses name; mobile launchers may use short_name.
    name: APP_SHORT_NAME,
    shortName: APP_SHORT_NAME,
    description: APP_DESCRIPTION,
    shouldApply: () => !tenantSlug(),
  });
  const renderCurrent = () => {
    const slug = tenantSlug();
    if (slug) {
      const branding = useBrandingStore.getState().branding;
      render(slug, branding?.name || APP_SHORT_NAME, branding?.report_logo || null);
    } else {
      document.title = APP_SHORT_NAME;
      refreshPlatform();
    }
  };
  renderCurrent();
  useBrandingStore.subscribe(renderCurrent);
  useAuthStore.subscribe((auth, previous) => {
    if (!!auth.token !== !!previous.token || auth.madrasaSlug !== previous.madrasaSlug) {
      renderCurrent();
    }
  });
}
