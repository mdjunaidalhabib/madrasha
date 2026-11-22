import { lazy, Suspense, useLayoutEffect, useEffect, useMemo, useRef, useState, type ComponentProps, type CSSProperties, type ReactNode } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  ChevronUp,
  ChevronRight,
  Home,
  Images,
  Users,
  BookOpen,
  GraduationCap,
  Info,
  Loader2,
  LogIn,
  Mail,
  MapPin,
  Menu,
  Phone,
  PlayCircle,
  Quote,
  X,
  ZoomIn,
} from "lucide-react";
import { Skeleton } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { getPublicWebsite } from "../../services/publicWebsiteApi";
import { getResolvedDomainSlugSync } from "../../services/domainResolve";
import { getTenantGuardianBase } from "../../utils/tenantSlug";
import { useCustomDomainRedirect } from "../../utils/useCustomDomainRedirect";
import { accentStrong, accentText, initials, mixHex, pickTextOn, withAlpha } from "./colorUtils";
import HeroSlider from "./HeroSlider";
import DonationSection from "./DonationSection";
import PublicMobileMenu from "./PublicMobileMenu";
import ContactSection from "./ContactSection";
import { getBrandingContact } from "./brandingContact";
import PlatformSocialLinks, { getWebsiteSocialLinks } from "./PlatformSocialLinks";
import { SiWhatsapp as WhatsAppIcon } from "react-icons/si";
import MapPreview from "./MapPreview";
import NoticeMarquee from "./NoticeMarquee";
import { resolveTheme, type ThemeTokens } from "./themes";
import {
  LanguageSwitcher,
  formatDate as formatLangDate,
  localizeDigits,
  useIsMadrasa,
  useLang,
  useText,
  type Lang,
} from "@madrasha/shared-ui/src/i18n";
import { websiteText } from "./website.text";
import SidebarAwareGrid from "./SidebarAwareGrid";
import "./PublicWebsitePage.css";
import "./PublicWebsiteThemes.css";

/** YouTube লিংক থেকে ভিডিও আইডি বের করে - এম্বেড প্লেয়ার ও থাম্বনেইল দুটোতেই লাগে। */
// Menu entry. হোম goes to the top of the home page. যোগাযোগ has no section on the home page — it routes to the
// contact page. Other entries scroll in-page on home; from the contact page
// (homeTo set) they route back home with the section hash. All client-side.
function NavItem({
  sectionKey,
  contactTo,
  homePath,
  homeTo,
  ...rest
}: { sectionKey: string; contactTo: string; homePath: string; homeTo?: string } & Omit<ComponentProps<"a">, "href">) {
  if (sectionKey === "contact") return <Link to={contactTo} {...rest} />;
  if (sectionKey === "home") return <Link to={homePath} {...rest} />;
  if (homeTo) return <Link to={{ pathname: homeTo, hash: `#${sectionKey}` }} {...rest} />;
  return <a href={`#${sectionKey}`} {...rest} />;
}

// Last fetched website per slug, so moving between home and যোগাযোগ renders
// instantly (navbar/notice bar/footer never flash a loader).
const websiteCache = new Map<string, any>();
const AdmissionApplyPage = lazy(() => import("./AdmissionApplyPage"));

function youtubeId(url?: string | null): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return match ? match[1] : null;
}

function youtubeThumbnail(url?: string | null): string | null {
  const id = youtubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

function youtubeEmbedUrl(url?: string | null): string | null {
  const id = youtubeId(url);
  return id ? `https://www.youtube.com/embed/${id}?autoplay=1` : null;
}

function formatDate(value: string | null | undefined, lang: Lang) {
  if (!value) return "";
  return formatLangDate(value, lang, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function dateParts(value: string | null | undefined, lang: Lang) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return {
    day: formatLangDate(d, lang, { day: "numeric" }),
    month: formatLangDate(d, lang, { month: "short" }),
    year: formatLangDate(d, lang, { year: "numeric" }),
  };
}

function isRecent(value?: string | null) {
  if (!value) return false;
  const days = (Date.now() - new Date(value).getTime()) / 86400000;
  return days >= 0 && days <= 7;
}




function SectionHeader({
  eyebrow,
  title,
  accentSolid,
  accentLabel,
  theme,
  light = false,
}: {
  eyebrow: string;
  title: string;
  accentSolid: string;
  accentLabel: string;
  theme: ThemeTokens;
  light?: boolean;
}) {
  const line = light ? "rgba(255,255,255,0.5)" : withAlpha(accentSolid, 0.45);
  const titleColor = light ? "text-white" : "text-slate-900";

  if (["ornament", "oversized", "ruled"].includes(theme.sectionHeader)) {
    return (
      <div className={`reveal public-section-heading public-section-heading--${theme.sectionHeader}`} style={{ "--heading-accent": light ? "#ffffff" : accentLabel } as CSSProperties}>
        <p className="public-section-eyebrow text-xs font-bold" style={{ color: light ? "#ffffff" : accentLabel }}>{eyebrow}</p>
        <h2 className={`mt-3 text-2xl font-extrabold leading-snug md:text-4xl ${titleColor}`}>{title}</h2>
        <span className="public-section-ornament" aria-hidden="true">◆</span>
      </div>
    );
  }

  // Modern: start-aligned, eyebrow as an accent pill, accent bar beside the title.
  if (theme.sectionHeader === "start-bar") {
    return (
      <div className="reveal flex flex-col items-start text-start">
        <span
          className={`inline-block px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${theme.round}`}
          style={{
            backgroundColor: light ? "rgba(255,255,255,0.15)" : withAlpha(accentSolid, 0.1),
            color: light ? "rgba(255,255,255,0.9)" : accentLabel,
          }}
        >
          {eyebrow}
        </span>
        <div className="mt-3 flex items-stretch gap-3">
          <span
            className="w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: light ? "#ffffff" : accentSolid }}
            aria-hidden="true"
          />
          <h2 className={`text-2xl font-extrabold tracking-tight md:text-4xl ${titleColor}`}>{title}</h2>
        </div>
      </div>
    );
  }

  // Minimal: plain uppercase title with a thin full-width underline.
  if (theme.sectionHeader === "underline") {
    return (
      <div className="reveal text-start">
        <p
          className="text-[11px] font-bold uppercase tracking-[0.24em]"
          style={{ color: light ? "rgba(255,255,255,0.75)" : accentLabel }}
        >
          {eyebrow}
        </p>
        <h2 className={`mt-2 text-xl font-bold uppercase tracking-wide md:text-3xl ${titleColor}`}>{title}</h2>
        <div
          className="relative mt-4 h-px w-full"
          style={{ backgroundColor: light ? "rgba(255,255,255,0.3)" : "#e2e8f0" }}
          aria-hidden="true"
        >
          <span
            className="absolute start-0 top-[-1px] h-[3px] w-16"
            style={{ backgroundColor: light ? "#ffffff" : accentSolid }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="reveal flex flex-col items-center text-center">
      <div className="flex items-center gap-3">
        <span className="h-px w-8 md:w-12" style={{ backgroundColor: line }} />
        <p
          className="text-xs font-bold uppercase tracking-[0.22em]"
          style={{ color: light ? "rgba(255,255,255,0.85)" : accentLabel }}
        >
          {eyebrow}
        </p>
        <span className="h-px w-8 md:w-12" style={{ backgroundColor: line }} />
      </div>
      <h2
        className={`mt-3 text-2xl font-extrabold tracking-tight md:text-4xl ${titleColor}`}
      >
        {title}
      </h2>
      <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
        <span className="h-1 w-10 rounded-full" style={{ backgroundColor: light ? "#ffffff" : accentSolid }} />
        <span className="h-1 w-2 rounded-full" style={{ backgroundColor: light ? "rgba(255,255,255,0.5)" : withAlpha(accentSolid, 0.4) }} />
        <span className="h-1 w-1 rounded-full" style={{ backgroundColor: light ? "rgba(255,255,255,0.35)" : withAlpha(accentSolid, 0.25) }} />
      </div>
    </div>
  );
}

function PersonCard({
  name,
  role,
  photo,
  accentSolid,
  accentLabel,
  theme,
  delay = 0,
}: {
  name: string;
  role: string;
  photo?: string | null;
  accentSolid: string;
  accentLabel: string;
  theme: ThemeTokens;
  delay?: number;
}) {
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const avatarSrc = photo && photo !== failedPhoto ? photo : "/images/teacher-avatar.svg";

  return (
    <div
      className={`group overflow-hidden ${theme.card} ${theme.person} text-center`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div
        className="h-16"
        style={{ background: `linear-gradient(135deg, ${withAlpha(accentSolid, 0.18)}, ${withAlpha(accentSolid, 0.05)})` }}
      />
      <div className="-mt-10 px-5 pb-6">
        <img
          src={avatarSrc}
          alt={name}
          loading="lazy"
          decoding="async"
          onError={() => { if (photo) setFailedPhoto(photo); }}
          className={`mx-auto h-20 w-20 ${theme.round} object-cover shadow-md ring-4 ring-white transition duration-300 group-hover:scale-105`}
        />
        <div className="mt-4 font-bold leading-snug text-slate-900">{name}</div>
        <div
          className={`mx-auto mt-2 inline-block max-w-full ${theme.round} px-3 py-1 text-xs font-semibold`}
          style={{ backgroundColor: withAlpha(accentSolid, 0.1), color: accentLabel }}
        >
          {role}
        </div>
      </div>
    </div>
  );
}

export default function PublicWebsitePage({
  slug: slugProp,
  view = "home",
}: { slug?: string; view?: "home" | "contact" | "admission" } = {}) {
  const t = useText(websiteText);
  const lang = useLang();
  const isMadrasa = useIsMadrasa();
  // The public website always uses its light palette. Keep the saved panel
  // preference available again when the visitor leaves the public website.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    const previousScheme = root.style.colorScheme;
    root.classList.remove("dark");
    root.style.colorScheme = "light";
    return () => {
      root.classList.toggle("dark", wasDark);
      root.style.colorScheme = previousScheme;
    };
  }, []);
  const params = useParams();
  const { pathname, hash, key: navigationKey } = useLocation();
  const slug = slugProp || params.madrasaSlug || params.slug || getResolvedDomainSlugSync();
  const [data, setData] = useState<any>(() => websiteCache.get(slug) ?? null);
  const [loading, setLoading] = useState(() => !websiteCache.has(slug));
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [activeId, setActiveId] = useState("");
  const [lightbox, setLightbox] = useState<{ url: string; title: string } | null>(null);
  const [videoLightbox, setVideoLightbox] = useState<{ url: string; title: string; native?: boolean } | null>(null);
  const [galleryInView, setGalleryInView] = useState(false);
  const galleryGridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const cached = websiteCache.get(slug);
    setLoading(!cached);
    setData(cached ?? null);
    setError("");
    getPublicWebsite(slug)
      .then((res) => {
        websiteCache.set(slug, res);
        setData(res);
      })
      .catch((err) => {
        // A suspended/disabled site must not keep showing the copy cached
        // earlier in this tab.
        websiteCache.delete(slug);
        setData(null);
        setError(err?.response?.data?.message || t.siteUnavailable);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const madrasa = data?.madrasa;
  useCustomDomainRedirect(madrasa?.custom_domain);
  const settings = data?.settings || {};
  const notices = data?.notices || [];
  const teachers = data?.teachers || [];
  const gallery = data?.gallery || [];
  const slides = data?.slides || [];
  const committee = data?.committee || [];
  const videos = data?.videos || [];

  const pageMap = useMemo(() => {
    const pages = data?.pages || [];
    const map: Record<string, any> = {};
    pages.forEach((page: any) => {
      map[page.page_key] = page;
    });
    return map;
  }, [data]);

  const theme = resolveTheme(settings.theme_key);
  const themeColor = settings.theme_color || "#2563eb";
  const accentSolid = useMemo(() => accentStrong(themeColor), [themeColor]);
  const accentLabel = useMemo(() => accentText(themeColor), [themeColor]);
  const onAccent = useMemo(() => pickTextOn(accentSolid), [accentSolid]);
  // Dark gradient stops for the admission band.
  // Darkened enough that white text stays readable whatever theme
  // color an admin picks; the pure theme color still shows through the glow.
  const accentBand = useMemo(() => mixHex(accentSolid, "#000000", 0.4), [accentSolid]);
  const accentDeep = useMemo(() => mixHex(accentSolid, "#0b1220", 0.72), [accentSolid]);
  // Theme color lifted for use as an icon tint on the near-black footer.
  const accentLabelOnDark = useMemo(() => mixHex(accentSolid, "#ffffff", 0.4), [accentSolid]);
  const guardianLoginUrl = `${getTenantGuardianBase(slug)}/login`;
  // Site root for this tenant ("/slug", "/m/slug" or "/" on a custom domain);
  // every internal link is built from it so it resolves the same on any view.
  const homePath =
    (view !== "home" ? pathname.replace(/\/(contact|admission)\/?$/, "") : pathname.replace(/\/$/, "")) || "/";
  const sitePath = (sub: string) => (homePath === "/" ? `/${sub}` : `${homePath}/${sub}`);
  const admissionUrl = sitePath("admission");
  const contactUrl = sitePath("contact");
  const navProps = { contactTo: contactUrl, homePath, homeTo: view === "home" ? undefined : homePath };

  const visibleSections = useMemo(() => {
    const s = data?.settings || {};
    const list: string[] = [];
    if (s.show_about !== 0 && pageMap.about) list.push("about");
    if (s.show_gallery !== 0) list.push("gallery");
    if (s.show_video_gallery !== 0 && videos.length) list.push("video");
    if (s.show_teachers !== 0 && teachers.length) list.push("teachers");
    if (s.show_muhtamim !== 0 && settings.muhtamim_message) list.push("muhtamim");
    if (s.show_sovapoti !== 0 && settings.sovapoti_message) list.push("sovapoti");
    if (s.show_committee !== 0 && committee.length) list.push("committee");
    if (s.show_admission !== 0 && pageMap.admission) list.push("admission");
    if (s.show_notices !== 0) list.push("notices");
    if (data?.donation) list.push("donation");
    if (s.show_contact !== 0) list.push("contact");
    return list;
  }, [data, pageMap, committee.length, settings.muhtamim_message, settings.sovapoti_message, videos.length, teachers.length]);
  const navKeys = useMemo(() => ["home", ...visibleSections], [visibleSections]);
  const primaryNavKeys = useMemo(
    () => ["home", "about", "admission", "teachers", "notices", "donation", "contact"]
      .filter((key) => key === "home" || visibleSections.includes(key)),
    [visibleSections],
  );

  // Left column (main reading flow) vs. right sidebar (notices + বাণী + committee),
  // in the fixed order the sidebar was designed around: notices on top, then
  // Muhtamim's message, then Sovapoti's message, then the committee list.
  const mainFlowKeys = useMemo(
    () => visibleSections.filter((key) => key === "about" || key === "gallery" || key === "video" || key === "teachers"),
    [visibleSections],
  );
  const sidebarFlowKeys = useMemo(() => {
    const order = ["notices", "muhtamim", "sovapoti", "committee"];
    return order.filter((key) => visibleSections.includes(key));
  }, [visibleSections]);
  const tailFlowKeys = useMemo(
    () => visibleSections.filter((key) => key === "admission"),
    [visibleSections],
  );

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
      setShowTop(window.scrollY > 560);
      let current = view === "home" ? "home" : view;
      for (const key of visibleSections) {
        const el = document.getElementById(key);
        if (el && el.getBoundingClientRect().top - 140 <= 0) current = key;
      }
      setActiveId(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [visibleSections, view]);

  // Route changes keep the scroll position, so on every navigation jump to the
  // "#section" the menu asked for (home), or to the top (contact / plain home).
  // Keyed on hasData, not data, so a background refresh never moves the page.
  const hasData = Boolean(data);
  useEffect(() => {
    if (!hasData) return;
    const id = requestAnimationFrame(() => {
      const target = view === "home" && hash ? document.getElementById(hash.slice(1)) : null;
      if (target) target.scrollIntoView();
      else window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    });
    return () => cancelAnimationFrame(id);
  }, [hasData, view, pathname, hash, navigationKey]);

  useEffect(() => {
    if (!lightbox && !videoLightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightbox(null);
        setVideoLightbox(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, videoLightbox]);

  useEffect(() => {
    const el = galleryGridRef.current;
    if (!el || !gallery.length || galleryInView) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setGalleryInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [gallery.length, galleryInView, view]);

  // Scroll-reveal: fade/slide sections in as they enter the viewport.
  useEffect(() => {
    if (!data) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal:not(.is-visible)"));
    if (!els.length) return;
    if (typeof IntersectionObserver === "undefined") {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [data, visibleSections, view]);

  // Smooth in-page anchor scrolling, scoped to this page only.
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.scrollBehavior;
    root.style.scrollBehavior = "smooth";
    return () => {
      root.style.scrollBehavior = prev;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-slate-900">
        {/* Navbar skeleton — mirrors the real header layout so it never renders blank */}
        <header className="fixed inset-x-0 top-0 z-50 bg-white shadow-sm">
          <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <div className="min-w-0 space-y-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>


          <div className="hidden shrink-0 items-center gap-1.5 lg:flex">
              <Skeleton className="h-9 w-28 rounded-xl" />
              <Skeleton className="h-9 w-28 rounded-xl" />
            </div>
            <Skeleton className="h-9 w-9 shrink-0 rounded-lg lg:hidden" />
          </div>
          <div className="hidden items-center justify-center gap-6 border-t border-slate-100 px-4 py-3 lg:flex">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-3.5 w-16" />
            ))}
          </div>
        </header>

        <div className="flex min-h-screen flex-col items-center justify-center gap-3 pt-24 text-slate-500">
          <Loader2 size={32} className="animate-spin text-blue-600" />
          <p className="text-sm font-medium">{t.loadingSite}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
            <Info size={26} />
          </div>
          <h1 className="mt-4 text-lg font-bold text-slate-900">{error}</h1>
          <p className="mt-2 text-sm text-slate-500">
            {t.unavailableHint}
          </p>
        </div>
      </div>
    );
  }

  const mapsUrl =
    settings.map_url ||
    (madrasa?.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(madrasa.address)}`
      : "");

  const socials = getWebsiteSocialLinks(settings, t.whatsappChannel);
  const { phones, emails, whatsappUrl } = getBrandingContact(madrasa, settings);

  const sectionBase = "py-16 md:py-24 scroll-mt-28";

  return (
    <div id="page-top" data-website-theme={theme.key} className="public-website-theme min-h-screen bg-white text-slate-900" style={{ "--website-accent": accentSolid, "--website-tint": withAlpha(accentSolid, 0.06) } as CSSProperties}>
      {/* Header — sticky in normal flow (never overlaps the hero) */}
      <header
        className={`sticky top-0 z-50 bg-white transition-shadow duration-300 ${theme.header} ${
          scrolled ? theme.headerScrolled : ""
        }`}
      >
        {/* Brand, primary navigation and actions share one row. */}
        <div
          className={`mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-4 transition-all duration-300 ${
            scrolled ? "py-2" : "py-3"
          }`}
        >
          <Link
            to={homePath}
            className="flex min-w-0 flex-1 items-center gap-2.5 lg:max-w-[230px] xl:max-w-[280px] 2xl:max-w-[360px]"
          >
            {madrasa?.logo_url ? (
              <img
                src={madrasa?.logo_url}
                alt={t.logo}
                className="public-website-logo h-11 w-11 shrink-0 object-cover"
              />
            ) : (
              <span aria-hidden="true" className="public-website-logo flex h-11 w-11 shrink-0 items-center justify-center" style={{ color: accentSolid, backgroundColor: withAlpha(accentSolid, 0.07) }}>
                <GraduationCap size={24} strokeWidth={1.7} />
              </span>
            )}
            <div className="min-w-0">
              <div title={madrasa?.name} className="truncate text-base font-extrabold leading-tight text-slate-900 md:text-lg">
                {madrasa?.name}
              </div>
              <div className="text-[11px] font-semibold tracking-wide text-slate-400">{t.officialWebsite}</div>
            </div>
          </Link>

          <nav aria-label={t.menu} className="hidden shrink-0 items-center justify-center gap-0.5 lg:flex xl:gap-1">
          {primaryNavKeys.map((key) => (
            <NavItem
              key={key}
              sectionKey={key} {...navProps}
              className="whitespace-nowrap rounded-md px-2 py-2 text-[13px] font-medium transition hover:bg-slate-100 xl:px-2.5"
              style={activeId === key ? { color: accentLabel, backgroundColor: withAlpha(accentSolid, 0.08) } : { color: "#475569" }}
            >
              {t.nav[key]}
            </NavItem>
          ))}
        </nav>

          <div className="hidden shrink-0 items-center gap-1.5 lg:flex">
            <LanguageSwitcher />
            <Link
              to={guardianLoginUrl}
              aria-label={t.guardianLogin}
              title={t.guardianLogin}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap ${theme.button} border px-2.5 py-2 text-sm font-medium transition hover:bg-slate-50`}
              style={{ borderColor: withAlpha(accentSolid, 0.35), color: accentLabel }}
            >
              <LogIn size={15} />
              <span className="hidden 2xl:inline">{t.guardianLogin}</span>
            </Link>
            <Link
              to={admissionUrl}
              className={`hidden items-center gap-1.5 whitespace-nowrap ${theme.button} px-3 py-2 text-sm font-semibold xl:inline-flex ${theme.shadowSm} transition hover:opacity-90`}
              style={{ backgroundColor: accentSolid, color: onAccent }}
            >
              {t.onlineAdmission}
              <ArrowRight size={15} className="rtl:rotate-180" />
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="public-mobile-menu-trigger lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="public-mobile-menu"
            aria-haspopup="dialog"
            aria-label={t.menu}
          >
            <Menu size={22} />
          </button>
        </div>

      </header>

      {settings.show_notice_bar !== 0 && (
        <NoticeMarquee text={settings.notice_bar_text} speed={settings.notice_bar_speed} />
      )}

      <PublicMobileMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        name={madrasa?.name || ""}
        logo={madrasa?.logo_url}
        phone={madrasa?.phone}
        homeUrl={homePath}
        admissionUrl={admissionUrl}
        guardianLoginUrl={guardianLoginUrl}
        accent={accentSolid}
        onAccent={onAccent}
      >
        {navKeys.map((key) => {
          const Icon = ({ home: Home, about: Info, admission: BookOpen, teachers: GraduationCap, notices: Bell, contact: Phone, gallery: Images, video: PlayCircle, committee: Users, muhtamim: Quote, sovapoti: Quote } as Record<string, typeof Home>)[key] || Info;
          const active = activeId === key;
          return (
            <NavItem
              key={key}
              sectionKey={key} {...navProps}
              onClick={() => setMenuOpen(false)}
              aria-current={active ? "location" : undefined}
              className={"public-mobile-menu__link " + (active ? "is-active" : "")}
            >
              <span className="public-mobile-menu__icon"><Icon size={19} strokeWidth={1.8} aria-hidden="true" /></span>
              <span className="min-w-0 flex-1">{t.nav[key]}</span>
              <ChevronRight size={16} className="public-mobile-menu__arrow rtl:rotate-180" aria-hidden="true" />
            </NavItem>
          );
        })}
      </PublicMobileMenu>

      {view === "admission" ? (
        <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="animate-spin" /></div>}>
          <AdmissionApplyPage key={slug} data={data} slug={slug} homePath={homePath} />
        </Suspense>
      ) : view === "contact" ? (
        <ContactSection
          madrasa={madrasa}
          settings={settings}
          pageMap={pageMap}
          theme={theme}
          accentSolid={accentSolid}
          onAccent={onAccent}
        />
      ) : (
      <>
      {/* Hero / Slider */}
      <HeroSlider
        slides={settings.show_slider !== 0 ? slides : []}
        fallbackTitle={settings.hero_title || madrasa?.name || ""}
        fallbackSubtitle={settings.hero_subtitle || madrasa?.address || t.welcomeFallback}
        accentSolid={accentSolid}
        variant={theme.hero}
        websiteStatus={madrasa?.website_status}
        actions={
          visibleSections.includes("about") && (
            <a
              href="#about"
              className={`inline-flex items-center gap-2 ${theme.button} border border-white/40 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20`}
            >
              {t.learnAboutUs}
            </a>
          )
        }
      />

      {(mainFlowKeys.length > 0 || sidebarFlowKeys.length > 0) && (
        <section className={`bg-white ${sectionBase}`}>
          <div className="mx-auto max-w-[1200px] px-4">
            <div className="public-website-flow">
              {/* Sidebar: নোটিশ → মুহতামিমের বাণী → সভাপতির বাণী → কমিটি */}
              {sidebarFlowKeys.length > 0 && (
                <aside className="public-website-sidebar">
                  <div className="space-y-6">
                    {sidebarFlowKeys.map((key) => {
                      if (key === "notices") {
                        return (
                          <div
                            key="notices"
                            id="notices"
                            className={`reveal scroll-mt-28 ${theme.card} ${theme.panelSurface} p-5`}
                          >
                            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                              <Bell size={18} style={{ color: accentSolid }} />
                              <h3 className="text-base font-bold text-slate-900">{t.noticeBoard}</h3>
                            </div>
                            {notices.length ? (
                              <ul className="mt-3 max-h-[420px] space-y-3 overflow-y-auto pe-1">
                                {notices.map((notice: any) => {
                                  const parts = dateParts(notice.published_at, lang);
                                  return (
                                    <li key={notice.id} className="border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                                      <div className="flex items-start justify-between gap-2">
                                        <p className="text-sm font-semibold leading-snug text-slate-800">
                                          {notice.title}
                                        </p>
                                        {isRecent(notice.published_at) && (
                                          <span
                                            className={`${theme.round} shrink-0 px-2 py-0.5 text-[10px] font-bold`}
                                            style={{ backgroundColor: withAlpha(accentSolid, 0.12), color: accentLabel }}
                                          >
                                            {t.newBadge}
                                          </span>
                                        )}
                                      </div>
                                      {notice.content && (
                                        <p className="mt-1 line-clamp-2 text-xs leading-6 text-slate-500">
                                          {notice.content}
                                        </p>
                                      )}
                                      {parts && (
                                        <p className="mt-1 text-[11px] font-medium text-slate-400">
                                          {formatDate(notice.published_at, lang)}
                                        </p>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              <p className="mt-3 text-xs text-slate-400">{t.noNotices}</p>
                            )}
                          </div>
                        );
                      }

                      if (key === "muhtamim") {
                        return (
                          <div
                            key="muhtamim"
                            id="muhtamim"
                            className={`reveal scroll-mt-28 ${theme.card} ${theme.panelSurface} p-5`}
                          >
                            <div className="flex items-center gap-3">
                              {settings.muhtamim_photo ? (
                                <img
                                  src={settings.muhtamim_photo}
                                  alt={settings.muhtamim_name || t.headMessage}
                                  className={`h-14 w-14 shrink-0 ${theme.round} object-cover shadow ring-2 ring-white`}
                                />
                              ) : (
                                <div
                                  className={`flex h-14 w-14 shrink-0 items-center justify-center ${theme.round} text-base font-bold`}
                                  style={{ backgroundColor: accentSolid, color: onAccent }}
                                >
                                  {initials(settings.muhtamim_name)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-900">
                                  {settings.muhtamim_name || t.headMessage}
                                </p>
                                {settings.muhtamim_designation && (
                                  <p className="text-xs font-semibold" style={{ color: accentLabel }}>
                                    {settings.muhtamim_designation}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Quote size={22} className="mt-3" style={{ color: withAlpha(accentSolid, 0.4) }} />
                            <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-600">
                              {settings.muhtamim_message}
                            </p>
                          </div>
                        );
                      }

                      if (key === "sovapoti") {
                        return (
                          <div
                            key="sovapoti"
                            id="sovapoti"
                            className={`reveal scroll-mt-28 ${theme.card} ${theme.panelSurface} p-5`}
                          >
                            <div className="flex items-center gap-3">
                              {settings.sovapoti_photo ? (
                                <img
                                  src={settings.sovapoti_photo}
                                  alt={settings.sovapoti_name || t.presidentMessage}
                                  className={`h-14 w-14 shrink-0 ${theme.round} object-cover shadow ring-2 ring-white`}
                                />
                              ) : (
                                <div
                                  className={`flex h-14 w-14 shrink-0 items-center justify-center ${theme.round} text-base font-bold`}
                                  style={{ backgroundColor: accentSolid, color: onAccent }}
                                >
                                  {initials(settings.sovapoti_name)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-900">
                                  {settings.sovapoti_name || t.presidentMessage}
                                </p>
                                {settings.sovapoti_designation && (
                                  <p className="text-xs font-semibold" style={{ color: accentLabel }}>
                                    {settings.sovapoti_designation}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Quote size={22} className="mt-3" style={{ color: withAlpha(accentSolid, 0.4) }} />
                            <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-600">
                              {settings.sovapoti_message}
                            </p>
                          </div>
                        );
                      }

                      if (key === "committee") {
                        return (
                          <div
                            key="committee"
                            id="committee"
                            className={`reveal scroll-mt-28 ${theme.card} ${theme.panelSurface} p-5`}
                          >
                            <h3 className="text-base font-bold text-slate-900">{t.committeeTitle}</h3>
                            <ul className="mt-3 space-y-3">
                              {committee.map((member: any) => (
                                <li key={member.id} className="flex items-center gap-3">
                                  {member.photo_url ? (
                                    <img
                                      src={member.photo_url}
                                      alt={member.name}
                                      className={`h-10 w-10 shrink-0 ${theme.round} object-cover`}
                                    />
                                  ) : (
                                    <div
                                      className={`flex h-10 w-10 shrink-0 items-center justify-center ${theme.round} text-xs font-bold`}
                                      style={{ backgroundColor: accentSolid, color: onAccent }}
                                    >
                                      {initials(member.name)}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-800">{member.name}</p>
                                    {member.designation && (
                                      <p className="truncate text-xs text-slate-500">{member.designation}</p>
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      }

                      return null;
                    })}
                  </div>
                </aside>
              )}
              {/* Main reading column: intro → gallery → video gallery → teachers */}
              {mainFlowKeys.length > 0 && (
                <div className="public-website-main">
                  {mainFlowKeys.map((key) => {
                    if (key === "about") {
                      return (
                        <section key="about" id="about" className="scroll-mt-28">
                          <SectionHeader
                            eyebrow={t.aboutEyebrow}
                            title={pageMap.about.title}
                            accentSolid={accentSolid}
                            accentLabel={accentLabel}
                            theme={theme}
                          />
                          <div
                            className="reveal mt-8 border-s-4 ps-5 md:ps-6"
                            style={{ borderColor: accentSolid }}
                          >
                            <p className="whitespace-pre-line text-sm leading-8 text-slate-600 md:text-base md:leading-9">
                              {pageMap.about.content}
                            </p>
                          </div>

                        </section>
                      );
                    }

                    if (key === "gallery") {
                      return (
                        <section key="gallery" id="gallery" className="scroll-mt-28">
                          <SectionHeader
                            eyebrow={t.galleryEyebrow}
                            title={t.galleryTitle}
                            accentSolid={accentSolid}
                            accentLabel={accentLabel}
                            theme={theme}
                          />
                          {gallery.length ? (
                            <SidebarAwareGrid
                              kind="gallery"
                              gridRef={galleryGridRef}
                              className={`gallery-grid ${
                                galleryInView ? "in-view" : ""
                              }`}
                            >
                              {gallery.map((item: any, idx: number) => (
                                <button
                                  type="button"
                                  key={item.id || item.image_url}
                                  onClick={() => setLightbox({ url: item.image_url, title: item.title || t.galleryFallback })}
                                  className={`gallery-item group relative aspect-square overflow-hidden ${theme.media} ${theme.gallery}`}
                                  style={{ transitionDelay: `${(idx % 12) * 60}ms` }}
                                  aria-label={item.title || t.galleryFallback}
                                >
                                  <img
                                    src={item.image_url}
                                    alt={item.title || t.galleryFallback}
                                    loading="lazy"
                                    decoding="async"
                                    className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/50 to-black/0 opacity-0 transition duration-300 group-hover:opacity-100">
                                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-lg">
                                      <ZoomIn size={20} />
                                    </span>
                                  </div>
                                </button>
                              ))}
                            </SidebarAwareGrid>
                          ) : (
                            <p className="mt-8 text-center text-sm text-slate-500">
                              {t.galleryEmpty}
                            </p>
                          )}
                        </section>
                      );
                    }

                    if (key === "video") {
                      return (
                        <section key="video" id="video" className="scroll-mt-28">
                          <SectionHeader
                            eyebrow={t.videoEyebrow}
                            title={t.videoTitle}
                            accentSolid={accentSolid}
                            accentLabel={accentLabel}
                            theme={theme}
                          />
                          <SidebarAwareGrid kind="video">
                            {videos.map((item: any) => {
                              const thumb = youtubeThumbnail(item.video_url);
                              const embed = youtubeEmbedUrl(item.video_url);
                              return (
                                <button
                                  type="button"
                                  key={item.id || item.video_url}
                                  onClick={() =>
                                    embed
                                      ? setVideoLightbox({ url: embed, title: item.title || t.videoFallback })
                                      : /\.(mp4|webm|ogg)(?:$|[?#])/i.test(item.video_url)
                                        ? setVideoLightbox({ url: item.video_url, title: item.title || t.videoFallback, native: true })
                                      : window.open(item.video_url, "_blank", "noopener,noreferrer")
                                  }
                                  className={`group relative aspect-video overflow-hidden text-start ${theme.media} ${theme.gallery}`}
                                  aria-label={item.title || t.videoFallback}
                                >
                                  {thumb ? (
                                    <img
                                      src={thumb}
                                      alt={item.title || t.videoFallback}
                                      loading="lazy"
                                      decoding="async"
                                      className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-slate-900 text-white/70">
                                      <PlayCircle size={36} />
                                    </div>
                                  )}
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/25 transition duration-300 group-hover:bg-black/40">
                                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-lg">
                                      <PlayCircle size={24} />
                                    </span>
                                  </div>
                                  {item.title && (
                                    <span className="absolute inset-x-0 bottom-0 line-clamp-1 bg-gradient-to-t from-black/70 to-transparent px-3 py-2 text-xs font-semibold text-white">
                                      {item.title}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </SidebarAwareGrid>
                        </section>
                      );
                    }

                    if (key === "teachers") {
                      return (
                        <section key="teachers" id="teachers" className="scroll-mt-28">
                          <SectionHeader
                            eyebrow={t.teachersEyebrow}
                            title={t.teachersTitle}
                            accentSolid={accentSolid}
                            accentLabel={accentLabel}
                            theme={theme}
                          />
                          <SidebarAwareGrid>
                            {teachers.map((teacher: any, idx: number) => (
                              <PersonCard
                                key={teacher.id}
                                name={teacher.name || teacher.teacher_name}
                                photo={teacher.photo_url}
                                role={[teacher.designation, teacher.subject].filter(Boolean).join(" · ") || t.teacherFallback}
                                accentSolid={accentSolid}
                                accentLabel={accentLabel}
                                theme={theme}
                                delay={(idx % 4) * 80}
                              />
                            ))}
                          </SidebarAwareGrid>
                          {teachers.some((teacher: any) => teacher.is_demo) && (
                            <p className="mt-4 text-xs text-slate-500">{t.demoTeachersHint}</p>
                          )}
                        </section>
                      );
                    }

                    return null;
                  })}
                </div>
              )}

            </div>
          </div>
        </section>
      )}

      {tailFlowKeys.map((key, index) => {
        const isAlt = index % 2 === 1;
        const bandClass = `${isAlt ? theme.altBg : "bg-white"} ${sectionBase}`;
        const bandStyle: CSSProperties | undefined =
          isAlt && theme.altTint ? { backgroundColor: withAlpha(accentSolid, theme.altTint) } : undefined;

        if (key === "admission") {
          return (
            <section
              key="admission"
              id="admission"
              className={`${sectionBase} relative overflow-hidden text-white`}
              style={{ background: `linear-gradient(135deg, ${accentBand} 0%, ${accentDeep} 100%)` }}
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.07]"
                style={{
                  backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
              />
              <div
                className="pointer-events-none absolute -bottom-32 -start-20 h-80 w-80 rounded-full blur-3xl"
                style={{ backgroundColor: withAlpha(accentSolid, 0.5) }}
              />
              <div className="relative mx-auto max-w-3xl px-4">
                <SectionHeader
                  light
                  eyebrow={t.admissionEyebrow}
                  title={pageMap.admission.title}
                  accentSolid={accentSolid}
                  accentLabel={accentLabel}
                theme={theme}
                />
                <div className={`reveal mt-10 ${theme.panel} bg-white/10 p-6 ring-1 ring-white/20 backdrop-blur md:p-10`}>
                  <p className="whitespace-pre-line text-sm leading-8 text-white/90 md:text-base md:leading-9">
                    {pageMap.admission.content}
                  </p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link
                      to={admissionUrl}
                      className={`inline-flex items-center gap-2 ${theme.button} bg-white px-6 py-3 text-sm font-bold text-slate-900 ${theme.shadowLg} transition hover:bg-slate-100`}
                    >
                      {t.fillAdmissionForm}
                      <ArrowRight size={16} className="rtl:rotate-180" />
                    </Link>
                    {settings.show_contact !== 0 && (
                      <Link
                        to={contactUrl}
                        className={`inline-flex items-center gap-2 ${theme.button} border border-white/40 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10`}
                      >
                        {t.contactUs}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </section>
          );
        }

        return null;
      })}
      </>
      )}

      {/* Footer */}
      {view === "home" && data?.donation && <DonationSection config={data.donation} accent={accentLabel} />}
      <footer className="relative bg-slate-950 text-slate-300">
        <div className="h-1 w-full" style={{ backgroundColor: accentSolid }} />

        <div className="mx-auto max-w-[1200px] px-4 py-14">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {/* Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <Link to={homePath} className="flex items-center gap-3">
                {madrasa?.logo_url ? (
                  <img
                    src={madrasa?.logo_url}
                    alt={t.logo}
                    className="public-website-logo h-11 w-11 shrink-0 object-cover"
                  />
                ) : (
                  <span aria-hidden="true" className="public-website-logo flex h-11 w-11 shrink-0 items-center justify-center bg-white/5" style={{ color: accentLabelOnDark }}>
                    <GraduationCap size={24} strokeWidth={1.7} />
                  </span>
                )}
                <span className="break-words text-lg font-extrabold leading-tight text-white">
                  {madrasa?.name}
                </span>
              </Link>
              <p className="mt-4 text-sm leading-7 text-slate-400">
                {settings.hero_subtitle || madrasa?.address || (isMadrasa ? t.taglineMadrasa : t.tagline)}
              </p>

              {socials.length > 0 && (
                <PlatformSocialLinks links={socials} className="mt-5" />
              )}
            </div>

            {/* Quick links */}
            {navKeys.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-white">{t.quickLinks}</h3>
                <span className="mt-2 block h-0.5 w-8 rounded-full" style={{ backgroundColor: accentSolid }} />
                <nav className="mt-4 flex flex-col gap-2.5 text-sm text-slate-400">
                  {navKeys.map((key) => (
                    <NavItem key={key} sectionKey={key} {...navProps} className="w-fit transition hover:text-white">
                      {t.nav[key]}
                    </NavItem>
                  ))}
                </nav>
              </div>
            )}

            {/* Contact */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-white">{t.contact}</h3>
              <span className="mt-2 block h-0.5 w-8 rounded-full" style={{ backgroundColor: accentSolid }} />
              <div className="mt-4 flex flex-col gap-3 text-sm text-slate-400">
                {[
                  ...(phones.length ? phones : [""]).map(phone => ({ Icon: Phone, label: t.phone, value: phone, href: phone ? `tel:${phone}` : undefined, external: false })),
                  ...(emails.length ? emails : [""]).map(email => ({ Icon: Mail, label: t.email, value: email, href: email ? `mailto:${email}` : undefined, external: false })),
                  { Icon: MapPin, label: t.address, value: madrasa?.address, href: madrasa?.address ? mapsUrl || undefined : undefined, external: true },
                ].map(({ Icon, label, value, href, external }) => (
                  <div key={`${label}-${value}`} className="flex items-start gap-2.5">
                    <Icon aria-hidden="true" size={16} className="mt-1 shrink-0" style={{ color: accentLabelOnDark }} />
                    <div className="min-w-0">
                      <span className="sr-only">{label}: </span>
                      {value && href ? <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} className="block break-words leading-6 transition hover:text-white">{value}</a> : <p className="text-xs leading-6 text-slate-500">{value || t.contactDetailsPending}</p>}
                    </div>
                  </div>
                ))}
                {whatsappUrl && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-start gap-2.5 transition hover:text-white"
                  >
                    <WhatsAppIcon size={16} color="#25D366" />
                    <span>{t.messageOnWhatsApp}</span>
                  </a>
                )}
              </div>

              {mapsUrl && (
                <MapPreview
                  href={mapsUrl}
                  compact
                  className="mt-4 h-28 w-full max-w-[260px] rounded-xl ring-1 ring-white/10 transition hover:ring-white/30"
                />
              )}
            </div>

            {/* CTA */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-white">{t.guardianAndAdmission}</h3>
              <span className="mt-2 block h-0.5 w-8 rounded-full" style={{ backgroundColor: accentSolid }} />
              <div className="mt-4 flex flex-col gap-2.5">
                <Link
                  to={admissionUrl}
                  className={`inline-flex items-center justify-center gap-1.5 ${theme.button} px-4 py-2.5 text-sm font-bold shadow-sm transition hover:opacity-90`}
                  style={{ backgroundColor: accentSolid, color: onAccent }}
                >
                  {t.onlineAdmission}
                </Link>
                <Link
                  to={guardianLoginUrl}
                  className={`inline-flex items-center justify-center gap-1.5 ${theme.button} border border-white/15 px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-white/5`}
                >
                  {t.guardianLogin}
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-2 px-4 py-3 text-center sm:flex-row sm:gap-4 sm:text-start">
            <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:justify-start">
              <p className="text-xs leading-5 text-slate-400">
                &copy; {localizeDigits(new Date().getFullYear(), lang)} {madrasa?.name}. {t.allRightsReserved}
              </p>
            </div>
            <a
              href="https://hikmahit.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded text-xs leading-5 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300"
            >
              <span className="text-slate-400">{t.poweredBy}</span>
              <span dir="ltr" className="font-semibold text-emerald-400 transition group-hover:text-emerald-300">Hikmah IT</span>
              <ArrowUpRight aria-hidden="true" size={13} className="text-slate-400 transition group-hover:text-emerald-300" />
            </a>
          </div>
        </div>
      </footer>

      {/* Back to top */}
      {showTop && (
        <a
          href="#page-top"
          className="fixed bottom-6 end-6 z-40 flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition hover:opacity-90"
          style={{ backgroundColor: accentSolid, color: onAccent }}
          aria-label={t.backToTop}
        >
          <ChevronUp size={20} />
        </a>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="animate-lightboxBackdrop fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute end-5 top-5 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label={t.close}
          >
            <X size={22} />
          </button>
          <img
            src={lightbox.url}
            alt={lightbox.title}
            className={`animate-lightboxImage max-h-[85vh] max-w-full ${theme.media} object-contain shadow-2xl`}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Video lightbox */}
      {videoLightbox && (
        <div
          className="animate-lightboxBackdrop fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setVideoLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setVideoLightbox(null)}
            className="absolute end-5 top-5 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label={t.close}
          >
            <X size={22} />
          </button>
          <div
            className="animate-lightboxImage aspect-video w-full max-w-3xl overflow-hidden rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {videoLightbox.native ? (
              <video src={videoLightbox.url} aria-label={videoLightbox.title} controls autoPlay playsInline className="h-full w-full bg-black" />
            ) : <iframe
              title={videoLightbox.title}
              src={videoLightbox.url}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full border-0"
            />}
          </div>
        </div>
      )}
    </div>
  );
}
