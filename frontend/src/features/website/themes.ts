// Public-website theme registry.
//
// A theme is NOT a separate copy of the page: it is a bag of Tailwind class
// strings plus a few flags that PublicWebsitePage / HeroSlider read. Every
// class listed here is written out in full (never assembled from fragments)
// so Tailwind's content scanner picks them up from this file.
//
// Missing, unknown or retired theme keys use Modern. The institution's
// theme_color still applies to every supported theme.

import type { WebsiteThemeKey } from "@madrasha/shared-ui/src/website/themes";
export type ThemeKey = WebsiteThemeKey;

export type SectionHeaderVariant = "centered-lines" | "start-bar" | "underline" | "ornament" | "oversized" | "ruled";
export type NavVariant = "band" | "inline" | "dark";
export type HeroVariant = "rounded" | "arch" | "sculpted" | "framed";

export interface ThemeTokens {
  key: ThemeKey;

  // Radii
  /** Standard card radius (person card, notice card, contact row, map box). */
  card: string;
  /** Large panel radius (about aside, muhtamim card, admission panel). */
  panel: string;
  /** Button radius. */
  button: string;
  /** Small icon-tile / date-box radius. */
  tile: string;
  /** Image radius (gallery items, muhtamim photo, lightbox). */
  media: string;
  /** Round things: logos, avatars, badges, social icons. */
  round: string;

  // Shadows (empty string = flat)
  shadowSm: string;
  shadowLg: string;
  shadowXl: string;

  // Composed surfaces (radius excluded - combine with `card`)
  quickLink: string;
  person: string;
  notice: string;
  contactRow: string;
  mapBox: string;
  /** Border + shadow of the muhtamim panel (background/padding stay in the page). */
  panelSurface: string;
  gallery: string;

  // Header / nav
  nav: NavVariant;
  /** Extra classes on the sticky <header> (always applied). */
  header: string;
  /** Extra classes on the sticky <header> once the page is scrolled. */
  headerScrolled: string;

  // Section headers
  sectionHeader: SectionHeaderVariant;
  /** Section intro paragraphs (contact blurb) follow the header alignment. */
  headerCentered: boolean;

  // Alternate (odd-index) section background
  /** Class for alternate sections. */
  altBg: string;
  /** If set, alternate sections also get an accent-tinted inline background at this alpha. */
  altTint: number | null;

  // Hero + quick-link overlap
  hero: HeroVariant;
  quickOverlap: string;
}

const modern: ThemeTokens = {
  "key": "modern",
  "card": "rounded-3xl",
  "panel": "rounded-[2rem]",
  "button": "rounded-full",
  "tile": "rounded-2xl",
  "media": "rounded-3xl",
  "round": "rounded-full",
  "shadowSm": "shadow-md shadow-slate-900/5",
  "shadowLg": "shadow-xl shadow-slate-900/10",
  "shadowXl": "shadow-2xl shadow-slate-900/15",
  "quickLink": "border border-transparent bg-white shadow-xl shadow-slate-900/10 transition hover:-translate-y-1 hover:shadow-2xl",
  "person": "border border-transparent bg-white shadow-md shadow-slate-900/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/10",
  "notice": "border border-transparent bg-white shadow-md shadow-slate-900/5 transition hover:shadow-xl hover:shadow-slate-900/10",
  "contactRow": "border border-transparent bg-white shadow-md shadow-slate-900/5 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-900/10",
  "mapBox": "border border-transparent bg-slate-100 shadow-md shadow-slate-900/5",
  "panelSurface": "border bg-white shadow-xl shadow-slate-900/5",
  "gallery": "shadow-md shadow-slate-900/10 transition-shadow duration-300 hover:shadow-2xl",
  "nav": "inline",
  "header": "border-b border-slate-100",
  "headerScrolled": "shadow-lg shadow-slate-900/5",
  "sectionHeader": "start-bar",
  "headerCentered": false,
  "altBg": "",
  "altTint": 0.05,
  "hero": "rounded",
  "quickOverlap": "-mt-8 md:-mt-10"
};

const heritage: ThemeTokens = {
  "key": "heritage",
  "card": "rounded-t-3xl rounded-b-md",
  "panel": "rounded-t-[3rem] rounded-b-lg",
  "button": "rounded-md",
  "tile": "rounded-t-xl rounded-b-sm",
  "media": "rounded-t-[2rem] rounded-b-sm",
  "round": "rounded-full",
  "shadowSm": "shadow-sm shadow-amber-900/5",
  "shadowLg": "shadow-lg shadow-amber-900/10",
  "shadowXl": "shadow-xl",
  "quickLink": "border border-slate-100 bg-white shadow-lg shadow-slate-900/5 transition hover:-translate-y-0.5 hover:shadow-xl",
  "person": "border border-amber-200/70 bg-[#fffdf7] transition duration-300 hover:-translate-y-1",
  "notice": "border border-slate-100 bg-white shadow-sm transition hover:shadow-md",
  "contactRow": "border border-amber-200/70 bg-[#fffdf7]",
  "mapBox": "border border-slate-200 bg-slate-100 shadow-sm",
  "panelSurface": "border border-amber-200/70 bg-[#fffdf7] shadow-sm",
  "gallery": "shadow-sm transition-shadow duration-300 hover:shadow-xl",
  "nav": "band",
  "header": "border-b border-amber-200/70",
  "headerScrolled": "shadow-md",
  "sectionHeader": "ornament",
  "headerCentered": true,
  "altBg": "bg-[#f7f1e5]",
  "altTint": null,
  "hero": "arch",
  "quickOverlap": "-mt-8 md:-mt-10"
};

const campus: ThemeTokens = {
  "key": "campus",
  "card": "rounded-[1.75rem] rounded-br-md",
  "panel": "rounded-[2.5rem] rounded-br-lg",
  "button": "rounded-full",
  "tile": "rounded-2xl",
  "media": "rounded-[2rem] rounded-br-md",
  "round": "rounded-full",
  "shadowSm": "shadow-md shadow-slate-900/5",
  "shadowLg": "shadow-xl shadow-slate-900/10",
  "shadowXl": "shadow-2xl shadow-slate-900/15",
  "quickLink": "border border-transparent bg-white shadow-xl shadow-slate-900/10 transition hover:-translate-y-1 hover:shadow-2xl",
  "person": "border-2 border-slate-100 bg-white shadow-[5px_5px_0_#e2e8f0] transition duration-300 hover:-translate-y-1",
  "notice": "border border-transparent bg-white shadow-md shadow-slate-900/5 transition hover:shadow-xl hover:shadow-slate-900/10",
  "contactRow": "border border-transparent bg-white shadow-md shadow-slate-900/5 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-900/10",
  "mapBox": "border border-transparent bg-slate-100 shadow-md shadow-slate-900/5",
  "panelSurface": "border-2 border-slate-100 bg-white shadow-[5px_5px_0_#e2e8f0]",
  "gallery": "shadow-md shadow-slate-900/10 transition-shadow duration-300 hover:shadow-2xl",
  "nav": "inline",
  "header": "border border-slate-200 shadow-lg shadow-slate-900/5",
  "headerScrolled": "shadow-lg shadow-slate-900/5",
  "sectionHeader": "oversized",
  "headerCentered": false,
  "altBg": "bg-sky-50",
  "altTint": 0.05,
  "hero": "sculpted",
  "quickOverlap": "-mt-8 md:-mt-10"
};

const editorial: ThemeTokens = {
  "key": "editorial",
  "card": "rounded-none",
  "panel": "rounded-none",
  "button": "rounded-none",
  "tile": "rounded-none",
  "media": "rounded-none",
  "round": "rounded-sm",
  "shadowSm": "",
  "shadowLg": "",
  "shadowXl": "",
  "quickLink": "border border-slate-300 bg-white transition hover:border-slate-900",
  "person": "border-t-2 border-b border-slate-300 bg-white transition-colors hover:bg-slate-50",
  "notice": "border border-slate-200 bg-white transition-colors hover:border-slate-900",
  "contactRow": "border border-slate-200 bg-white transition-colors hover:border-slate-900",
  "mapBox": "border border-slate-200 bg-slate-100",
  "panelSurface": "border-y border-slate-300 bg-white",
  "gallery": "border border-slate-200 transition-colors duration-300 hover:border-slate-900",
  "nav": "dark",
  "header": "border-y-2 border-slate-900",
  "headerScrolled": "",
  "sectionHeader": "ruled",
  "headerCentered": false,
  "altBg": "bg-white border-t border-slate-200",
  "altTint": null,
  "hero": "framed",
  "quickOverlap": "-mt-6 md:-mt-8"
};

export const THEMES: Record<ThemeKey, ThemeTokens> = { modern, heritage, campus, editorial };

export function resolveTheme(key?: string | null): ThemeTokens {
  return (key && Object.prototype.hasOwnProperty.call(THEMES, key) ? THEMES[key as ThemeKey] : THEMES.modern);
}
