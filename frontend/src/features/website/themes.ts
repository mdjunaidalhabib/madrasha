// Public-website theme registry.
//
// A theme is NOT a separate copy of the page: it is a bag of Tailwind class
// strings plus a few flags that PublicWebsitePage / HeroSlider read. Every
// class listed here is written out in full (never assembled from fragments)
// so Tailwind's content scanner picks them up from this file.
//
// "classic" reproduces the original design class-for-class, so madrasas that
// never picked a theme (or whose theme_key is missing/unknown) look exactly
// as they did before. The per-madrasa theme_color still applies on top of
// every theme - it is applied via inline styles in the page, not here.

export type ThemeKey = "classic" | "modern" | "minimal";

export type SectionHeaderVariant = "centered-lines" | "left-bar" | "underline";
export type NavVariant = "band" | "inline" | "dark";
export type HeroVariant = "classic" | "rounded" | "flat";

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

const classic: ThemeTokens = {
  key: "classic",

  card: "rounded-2xl",
  panel: "rounded-3xl",
  button: "rounded-xl",
  tile: "rounded-xl",
  media: "rounded-2xl",
  round: "rounded-full",

  shadowSm: "shadow-sm",
  shadowLg: "shadow-lg",
  shadowXl: "shadow-xl",

  quickLink:
    "border border-slate-100 bg-white shadow-lg shadow-slate-900/5 transition hover:-translate-y-0.5 hover:shadow-xl",
  person: "border border-slate-100 bg-white shadow-sm transition-shadow hover:shadow-lg",
  notice: "border border-slate-100 bg-white shadow-sm transition hover:shadow-md",
  contactRow: "border border-slate-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
  mapBox: "border border-slate-200 bg-slate-100 shadow-sm",
  panelSurface: "border bg-white shadow-sm",
  gallery: "shadow-sm transition-shadow duration-300 hover:shadow-xl",

  nav: "band",
  header: "",
  headerScrolled: "shadow-md",

  sectionHeader: "centered-lines",
  headerCentered: true,

  altBg: "bg-slate-50",
  altTint: null,

  hero: "classic",
  quickOverlap: "-mt-8 md:-mt-10",
};

const modern: ThemeTokens = {
  key: "modern",

  card: "rounded-3xl",
  panel: "rounded-[2rem]",
  button: "rounded-full",
  tile: "rounded-2xl",
  media: "rounded-3xl",
  round: "rounded-full",

  shadowSm: "shadow-md shadow-slate-900/5",
  shadowLg: "shadow-xl shadow-slate-900/10",
  shadowXl: "shadow-2xl shadow-slate-900/15",

  quickLink:
    "border border-transparent bg-white shadow-xl shadow-slate-900/10 transition hover:-translate-y-1 hover:shadow-2xl",
  person: "border border-transparent bg-white shadow-md shadow-slate-900/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/10",
  notice: "border border-transparent bg-white shadow-md shadow-slate-900/5 transition hover:shadow-xl hover:shadow-slate-900/10",
  contactRow:
    "border border-transparent bg-white shadow-md shadow-slate-900/5 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-900/10",
  mapBox: "border border-transparent bg-slate-100 shadow-md shadow-slate-900/5",
  panelSurface: "border bg-white shadow-xl shadow-slate-900/5",
  gallery: "shadow-md shadow-slate-900/10 transition-shadow duration-300 hover:shadow-2xl",

  nav: "inline",
  header: "border-b border-slate-100",
  headerScrolled: "shadow-lg shadow-slate-900/5",

  sectionHeader: "left-bar",
  headerCentered: false,

  altBg: "",
  altTint: 0.05,

  hero: "rounded",
  quickOverlap: "-mt-8 md:-mt-10",
};

const minimal: ThemeTokens = {
  key: "minimal",

  card: "rounded-sm",
  panel: "rounded-sm",
  button: "rounded-sm",
  tile: "rounded-sm",
  media: "rounded-sm",
  round: "rounded-sm",

  shadowSm: "",
  shadowLg: "",
  shadowXl: "",

  quickLink: "border border-slate-300 bg-white transition hover:border-slate-900",
  person: "border border-slate-200 bg-white transition-colors hover:border-slate-900",
  notice: "border border-slate-200 bg-white transition-colors hover:border-slate-900",
  contactRow: "border border-slate-200 bg-white transition-colors hover:border-slate-900",
  mapBox: "border border-slate-200 bg-slate-100",
  panelSurface: "border bg-white",
  gallery: "border border-slate-200 transition-colors duration-300 hover:border-slate-900",

  nav: "dark",
  header: "border-b border-slate-200",
  headerScrolled: "",

  sectionHeader: "underline",
  headerCentered: false,

  altBg: "bg-white border-t border-slate-200",
  altTint: null,

  hero: "flat",
  quickOverlap: "-mt-6 md:-mt-8",
};

export const THEMES: Record<ThemeKey, ThemeTokens> = { classic, modern, minimal };

export function resolveTheme(key?: string | null): ThemeTokens {
  return (key && Object.prototype.hasOwnProperty.call(THEMES, key) ? THEMES[key as ThemeKey] : THEMES.classic);
}
