import { useSyncExternalStore } from "react";
import { applyBrandFavicon, brandIconUrl, brandManifestIcons, type BrandIconSource } from "./brandIcons";

/**
 * PWA install plumbing shared by the admin panel and the public website.
 *
 * Chrome/Edge/Android fire `beforeinstallprompt` once the page is installable
 * (manifest + icons + service worker). We stash that event so our own
 * InstallPrompt banner can call `.prompt()` later - the native mini-infobar is
 * suppressed via preventDefault(). iOS Safari has no such event; there the
 * banner falls back to "Share → Add to Home Screen" instructions.
 *
 * `setupPwa()` must run before React renders - the event can fire very early
 * and is never re-fired for the same page load.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PwaState {
  deferredPrompt: BeforeInstallPromptEvent | null;
  installed: boolean;
  /** Set by setPwaManifest() - lets the banner show the tenant's own name. */
  appName: string | null;
  /** The madrasa's own 192px icon (from its logo) - null when it has no logo. */
  iconUrl: string | null;
}

let state: PwaState = { deferredPrompt: null, installed: false, appName: null, iconUrl: null };
const listeners = new Set<() => void>();

const setState = (patch: Partial<PwaState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  // iPadOS 13+ reports itself as a Mac with touch.
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

let initialized = false;

export function setupPwa() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  setState({ installed: isStandalone() });

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    setState({ deferredPrompt: e as BeforeInstallPromptEvent });
  });

  window.addEventListener("appinstalled", () => {
    setState({ deferredPrompt: null, installed: true });
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Not fatal - the site works fine without it, it's just not installable.
      });
    });
  }
}

/** For pages that keep a static (non-tenant) manifest, e.g. the platform's own
 * landing page: tells the install banner which icon that manifest carries. */
export const setStaticPwaIcon = (iconUrl: string | null) => {
  if (state.iconUrl !== iconUrl) setState({ iconUrl });
};

/** Opens the browser's native install dialog. Returns true if the user accepted. */
export async function promptInstall(): Promise<boolean> {
  const evt = state.deferredPrompt;
  if (!evt) return false;
  await evt.prompt();
  const { outcome } = await evt.userChoice;
  // A prompt event is single-use.
  setState({ deferredPrompt: null, installed: outcome === "accepted" || state.installed });
  return outcome === "accepted";
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const usePwaInstall = () => useSyncExternalStore(subscribe, () => state);

export interface PwaManifestOptions {
  name: string;
  shortName?: string;
  description?: string;
  /** Path the installed app opens at, e.g. "/m/darul-uloom". */
  startUrl?: string;
  /** The madrasa's logo-derived icons. Omitted/null => no icons at all (no default). */
  icons?: BrandIconSource | null;
  /** Default true: also hand `name` to the install banner. Pass false where the
   * banner already has its own label (the admin panel's "QMS Admin"). */
  announceName?: boolean;
  /** Default "standalone". "minimal-ui" makes installed desktop Chrome draw its
   * own Back / Reload buttons in the title bar, right after the app icon. */
  display?: "standalone" | "minimal-ui";
}

/**
 * Swaps the page's static manifest for one generated at runtime - used by the
 * multi-tenant public website so the installed app carries the madrasa's own
 * name and opens at that madrasa's page instead of the platform root.
 * Everything is absolute because a data: manifest has no base URL of its own.
 * Icons come ONLY from the madrasa's logo (see brandIcons.ts); without one the
 * manifest and favicon are left empty on purpose.
 */
export function setPwaManifest({
  name,
  shortName,
  description,
  startUrl = "/",
  icons = null,
  announceName = true,
  display = "standalone",
}: PwaManifestOptions) {
  const origin = window.location.origin;
  const abs = (p: string) => new URL(p, origin).href;
  const manifest = {
    id: abs(startUrl),
    name,
    short_name: shortName || name.slice(0, 24),
    description,
    lang: "bn",
    start_url: abs(startUrl),
    scope: abs("/"),
    display,
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#059669",
    icons: brandManifestIcons(icons),
  };

  let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "manifest";
    document.head.appendChild(link);
  }
  const href = `data:application/manifest+json;charset=utf-8,${encodeURIComponent(JSON.stringify(manifest))}`;
  if (link.href !== href) link.href = href;

  const appleTitle = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
  if (appleTitle) appleTitle.content = manifest.short_name;
  // Browser tab / iOS home-screen icon follow the same logo as the manifest.
  applyBrandFavicon(icons);

  const iconUrl = icons ? brandIconUrl(icons, "icon-192.png") : null;
  const nextName = announceName ? name : state.appName;
  if (state.appName !== nextName || state.iconUrl !== iconUrl) setState({ appName: nextName, iconUrl });
}
