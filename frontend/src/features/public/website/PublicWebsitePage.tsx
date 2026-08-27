import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Bell,
  ChevronUp,
  Facebook,
  GraduationCap,
  Image as ImageIcon,
  Info,
  Instagram,
  Loader2,
  Mail,
  MapPin,
  Menu,
  Phone,
  Quote,
  Users,
  UsersRound,
  X,
  Youtube,
} from "lucide-react";
import { getPublicWebsite } from "../../../services/websiteApi";
import { getTenantGuardianBase } from "../../../utils/tenantSlug";
import { accentStrong, accentText, initials, pickTextOn, withAlpha } from "./colorUtils";
import HeroSlider from "./HeroSlider";
import NoticeMarquee from "./NoticeMarquee";

const NAV_LABELS: Record<string, string> = {
  about: "পরিচিতি",
  muhtamim: "মুহতামিমের বাণী",
  admission: "ভর্তি তথ্য",
  teachers: "শিক্ষকবৃন্দ",
  committee: "কমিটি",
  gallery: "গ্যালারি",
  notices: "নোটিশ",
  contact: "যোগাযোগ",
};

function formatDate(value?: string | null) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("bn-BD", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function isRecent(value?: string | null) {
  if (!value) return false;
  const days = (Date.now() - new Date(value).getTime()) / 86400000;
  return days >= 0 && days <= 7;
}

function waLink(phone?: string | null) {
  const digits = (phone || "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "";
}

function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.472-.148-.67.15-.198.297-.767.966-.94 1.164-.173.198-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.372-.025-.521-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.876 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12.001 2C6.478 2 2 6.477 2 12c0 1.82.478 3.53 1.31 5.005L2 22l5.147-1.28A9.96 9.96 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12.001 2zm0 18.222a8.19 8.19 0 0 1-4.169-1.13l-.299-.177-3.055.76.797-2.981-.194-.306A8.19 8.19 0 0 1 3.778 12c0-4.535 3.688-8.222 8.223-8.222 4.535 0 8.222 3.687 8.222 8.222 0 4.535-3.687 8.222-8.222 8.222z" />
    </svg>
  );
}

function SectionHeader({
  index,
  icon,
  eyebrow,
  title,
  accentSolid,
  accentLabel,
  onAccent,
}: {
  index: number;
  icon: ReactNode;
  eyebrow: string;
  title: string;
  accentSolid: string;
  accentLabel: string;
  onAccent: string;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="text-[11px] font-bold tracking-[0.35em] text-slate-300">
        {String(index).padStart(2, "0")}
      </span>
      <div
        className="mt-3 flex h-12 w-12 items-center justify-center rounded-2xl shadow-md ring-4 ring-black/5"
        style={{ backgroundColor: accentSolid, color: onAccent }}
      >
        {icon}
      </div>
      <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: accentLabel }}>
        {eyebrow}
      </p>
      <h2 className="mt-1 text-2xl font-extrabold text-slate-900 md:text-3xl">{title}</h2>
      <div className="mt-3 h-1 w-14 rounded-full" style={{ backgroundColor: accentSolid }} />
    </div>
  );
}

export default function PublicWebsitePage() {
  const params = useParams();
  const slug = params.madrasaSlug || params.slug || "";
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [activeId, setActiveId] = useState("");
  const [lightbox, setLightbox] = useState<{ url: string; title: string } | null>(null);
  const [galleryInView, setGalleryInView] = useState(false);
  const galleryGridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLoading(true);
    setData(null);
    setError("");
    getPublicWebsite(slug)
      .then(setData)
      .catch((err) => setError(err?.response?.data?.message || "Website unavailable"))
      .finally(() => setLoading(false));
  }, [slug]);

  const madrasa = data?.madrasa;
  const settings = data?.settings || {};
  const notices = data?.notices || [];
  const teachers = data?.teachers || [];
  const gallery = data?.gallery || [];
  const slides = data?.slides || [];
  const committee = data?.committee || [];

  const pageMap = useMemo(() => {
    const pages = data?.pages || [];
    const map: Record<string, any> = {};
    pages.forEach((page: any) => {
      map[page.page_key] = page;
    });
    return map;
  }, [data]);

  const themeColor = settings.theme_color || "#2563eb";
  const accentSolid = useMemo(() => accentStrong(themeColor), [themeColor]);
  const accentLabel = useMemo(() => accentText(themeColor), [themeColor]);
  const onAccent = useMemo(() => pickTextOn(accentSolid), [accentSolid]);
  const guardianLoginUrl = `${getTenantGuardianBase(slug)}/login`;
  const admissionUrl = "admission";

  const visibleSections = useMemo(() => {
    const s = data?.settings || {};
    const list: string[] = [];
    if (s.show_about !== 0 && pageMap.about) list.push("about");
    if (s.show_muhtamim !== 0 && settings.muhtamim_message) list.push("muhtamim");
    if (s.show_admission !== 0 && pageMap.admission) list.push("admission");
    if (s.show_teachers !== 0) list.push("teachers");
    if (s.show_committee !== 0 && committee.length) list.push("committee");
    if (s.show_gallery !== 0) list.push("gallery");
    if (s.show_notices !== 0) list.push("notices");
    if (s.show_contact !== 0) list.push("contact");
    return list;
  }, [data, pageMap, committee.length, settings.muhtamim_message]);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
      setShowTop(window.scrollY > 560);
      let current = "";
      for (const key of visibleSections) {
        const el = document.getElementById(key);
        if (el && el.getBoundingClientRect().top - 140 <= 0) current = key;
      }
      setActiveId(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [visibleSections]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

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
  }, [gallery.length, galleryInView]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 size={32} className="animate-spin text-blue-600" />
          <p className="text-sm font-medium">Website লোড হচ্ছে...</p>
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
            Super Admin অথবা Madrasa Admin website status/settings check করতে পারেন।
          </p>
        </div>
      </div>
    );
  }

  const mapsUrl = madrasa?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(madrasa.address)}`
    : "";

  const sectionBase = "py-16 md:py-20 scroll-mt-24";

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Header */}
      <header
        className={`fixed inset-x-0 top-0 z-50 bg-white transition-shadow ${scrolled ? "shadow-sm" : ""}`}
      >
        {/* Row 1: brand (full name, never truncated) + actions */}
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <a href="#top" className="flex min-w-0 items-center gap-3">
            {madrasa?.logo_url ? (
              <img
                src={madrasa?.logo_url}
                alt="Logo"
                className="h-10 w-10 shrink-0 rounded-full object-cover shadow ring-2 ring-white"
              />
            ) : (
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold shadow"
                style={{ backgroundColor: accentSolid, color: onAccent }}
              >
                {initials(madrasa?.name)}
              </div>
            )}
            <div className="min-w-0">
              <div className="break-words text-base font-extrabold leading-tight text-slate-900">
                {madrasa?.name}
              </div>
              <div className="text-[11px] font-medium text-slate-400">Official Website</div>
            </div>
          </a>

          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            <Link
              to={guardianLoginUrl}
              className="whitespace-nowrap rounded-xl border px-3.5 py-2 text-sm font-bold transition hover:bg-slate-50"
              style={{ borderColor: withAlpha(accentSolid, 0.35), color: accentLabel }}
            >
              অভিভাবক লগইন
            </Link>
            <Link
              to={admissionUrl}
              className="whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-bold shadow-sm transition hover:opacity-90"
              style={{ backgroundColor: accentSolid, color: onAccent }}
            >
              অনলাইনে ভর্তি
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="shrink-0 rounded-lg p-2 text-slate-700 lg:hidden"
            aria-label="Menu"
          >
            <Menu size={22} />
          </button>
        </div>

        {/* Row 2: menu bar — distinct band, desktop only (mobile uses the drawer) */}
        <nav
          className="no-scrollbar hidden overflow-x-auto lg:block"
          style={{ backgroundColor: accentSolid }}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-center gap-1 px-4">
            {visibleSections.map((key) => (
              <a
                key={key}
                href={`#${key}`}
                className="relative whitespace-nowrap px-4 py-3 text-[13px] font-semibold transition"
                style={{ color: onAccent, opacity: activeId === key ? 1 : 0.78 }}
              >
                {NAV_LABELS[key]}
                <span
                  className="absolute inset-x-3 bottom-1.5 h-[2px] rounded-full transition-opacity"
                  style={{ backgroundColor: onAccent, opacity: activeId === key ? 1 : 0 }}
                />
              </a>
            ))}
          </div>
        </nav>

        {settings.show_notice_bar !== 0 && (
          <NoticeMarquee text={settings.notice_bar_text} speed={settings.notice_bar_speed} />
        )}
      </header>

      {/* Mobile menu: left-side sliding drawer */}
      <div
        className={`fixed inset-0 z-[55] bg-black/40 transition-opacity duration-300 lg:hidden ${
          menuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />
      <aside
        className={`fixed inset-y-0 left-0 z-[60] flex w-72 max-w-[80%] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-4">
          <div className="flex min-w-0 items-center gap-2">
            {madrasa?.logo_url ? (
              <img
                src={madrasa?.logo_url}
                alt="Logo"
                className="h-9 w-9 shrink-0 rounded-full object-cover shadow ring-2 ring-white"
              />
            ) : (
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow"
                style={{ backgroundColor: accentSolid, color: onAccent }}
              >
                {initials(madrasa?.name)}
              </div>
            )}
            <span className="break-words text-sm font-extrabold leading-tight text-slate-900">
              {madrasa?.name}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
          {visibleSections.map((key) => (
            <a
              key={key}
              href={`#${key}`}
              onClick={() => setMenuOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {NAV_LABELS[key]}
            </a>
          ))}
        </nav>

        <div className="flex flex-col gap-2 border-t border-slate-100 px-3 py-4">
          <Link
            to={admissionUrl}
            onClick={() => setMenuOpen(false)}
            className="rounded-xl px-4 py-2.5 text-center text-sm font-bold"
            style={{ backgroundColor: accentSolid, color: onAccent }}
          >
            অনলাইনে ভর্তি
          </Link>
          <Link
            to={guardianLoginUrl}
            onClick={() => setMenuOpen(false)}
            className="rounded-xl border px-4 py-2.5 text-center text-sm font-bold"
            style={{ borderColor: withAlpha(accentSolid, 0.35), color: accentLabel }}
          >
            অভিভাবক লগইন
          </Link>
          {madrasa?.phone && (
            <a
              href={`tel:${madrasa.phone}`}
              className="flex items-center justify-center gap-1.5 py-1 text-sm font-medium text-slate-500"
            >
              <Phone size={15} />
              {madrasa.phone}
            </a>
          )}
        </div>
      </aside>

      {/* Hero / Slider */}
      <HeroSlider
        slides={settings.show_slider !== 0 ? slides : []}
        fallbackTitle={settings.hero_title || madrasa?.name || ""}
        fallbackSubtitle={settings.hero_subtitle || madrasa?.address || "Welcome to our madrasa website."}
        accentSolid={accentSolid}
        websiteStatus={madrasa?.website_status}
      />

      {/* Quick info strip */}
      <div className="relative z-10 mx-auto mt-6 max-w-5xl px-4">
        <div className="grid gap-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-xl sm:grid-cols-3">
          <a
            href={madrasa?.phone ? `tel:${madrasa.phone}` : undefined}
            className="flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-slate-50"
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: accentSolid, color: onAccent }}
            >
              <Phone size={18} />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase text-slate-400">Phone</span>
              <span className="block truncate text-sm font-bold text-slate-800">
                {madrasa?.phone || "N/A"}
              </span>
            </span>
          </a>
          <a
            href={madrasa?.email ? `mailto:${madrasa.email}` : undefined}
            className="flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-slate-50"
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: accentSolid, color: onAccent }}
            >
              <Mail size={18} />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase text-slate-400">Email</span>
              <span className="block truncate text-sm font-bold text-slate-800">
                {madrasa?.email || "N/A"}
              </span>
            </span>
          </a>
          <a
            href={mapsUrl || undefined}
            target={mapsUrl ? "_blank" : undefined}
            rel="noreferrer"
            className="flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-slate-50"
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: accentSolid, color: onAccent }}
            >
              <MapPin size={18} />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase text-slate-400">Address</span>
              <span className="block truncate text-sm font-bold text-slate-800">
                {madrasa?.address || "N/A"}
              </span>
            </span>
          </a>
        </div>
      </div>

      {visibleSections.map((key, index) => {
        const bandClass = `${index % 2 === 1 ? "bg-slate-50" : "bg-white"} ${sectionBase}`;
        const num = index + 1;

        if (key === "about") {
          return (
            <section key="about" id="about" className={bandClass}>
              <div className="mx-auto max-w-3xl px-4">
                <SectionHeader
                  index={num}
                  icon={<Info size={22} />}
                  eyebrow="পরিচিতি"
                  title={pageMap.about.title}
                  accentSolid={accentSolid}
                  accentLabel={accentLabel}
                  onAccent={onAccent}
                />
                <p className="mt-8 whitespace-pre-line text-center text-sm leading-8 text-slate-600 md:text-base">
                  {pageMap.about.content}
                </p>
              </div>
            </section>
          );
        }

        if (key === "muhtamim") {
          return (
            <section key="muhtamim" id="muhtamim" className={bandClass}>
              <div className="mx-auto max-w-4xl px-4">
                <SectionHeader
                  index={num}
                  icon={<Quote size={22} />}
                  eyebrow="মুহতামিমের বাণী"
                  title={settings.muhtamim_name || "মুহতামিম সাহেবের বাণী"}
                  accentSolid={accentSolid}
                  accentLabel={accentLabel}
                  onAccent={onAccent}
                />
                <div
                  className="mt-10 flex flex-col items-center gap-6 rounded-3xl border p-6 text-center md:flex-row md:items-start md:text-left md:p-8"
                  style={{ borderColor: withAlpha(accentSolid, 0.2), backgroundColor: withAlpha(accentSolid, 0.05) }}
                >
                  {settings.muhtamim_photo ? (
                    <img
                      src={settings.muhtamim_photo}
                      alt={settings.muhtamim_name || "Muhtamim"}
                      className="h-28 w-28 shrink-0 rounded-2xl object-cover shadow-md"
                    />
                  ) : (
                    <div
                      className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold shadow-md"
                      style={{ backgroundColor: accentSolid, color: onAccent }}
                    >
                      {initials(settings.muhtamim_name)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <Quote size={26} style={{ color: accentSolid }} className="mx-auto md:mx-0" />
                    <p className="mt-3 whitespace-pre-line text-sm leading-8 text-slate-700 md:text-base">
                      {settings.muhtamim_message}
                    </p>
                    {settings.muhtamim_name && (
                      <p className="mt-4 text-sm font-extrabold text-slate-900">{settings.muhtamim_name}</p>
                    )}
                    {settings.muhtamim_designation && (
                      <p className="text-xs font-semibold" style={{ color: accentLabel }}>
                        {settings.muhtamim_designation}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          );
        }

        if (key === "admission") {
          return (
            <section key="admission" id="admission" className={bandClass}>
              <div className="mx-auto max-w-3xl px-4">
                <SectionHeader
                  index={num}
                  icon={<GraduationCap size={22} />}
                  eyebrow="ভর্তি"
                  title={pageMap.admission.title}
                  accentSolid={accentSolid}
                  accentLabel={accentLabel}
                  onAccent={onAccent}
                />
                <div
                  className="mt-8 rounded-3xl border p-6 md:p-8"
                  style={{
                    borderColor: withAlpha(accentSolid, 0.25),
                    backgroundColor: withAlpha(accentSolid, 0.06),
                  }}
                >
                  <p className="whitespace-pre-line text-sm leading-8 text-slate-700 md:text-base">
                    {pageMap.admission.content}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                      to={admissionUrl}
                      className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-bold shadow-sm transition hover:opacity-90"
                      style={{ backgroundColor: accentSolid, color: onAccent }}
                    >
                      অনলাইনে ভর্তি ফরম পূরণ করুন
                    </Link>
                    {settings.show_contact !== 0 && (
                      <a
                        href="#contact"
                        className="inline-flex items-center gap-1.5 rounded-xl border px-5 py-2.5 text-sm font-bold transition hover:bg-white"
                        style={{ borderColor: withAlpha(accentSolid, 0.3), color: accentLabel }}
                      >
                        যোগাযোগ করুন
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </section>
          );
        }

        if (key === "teachers") {
          return (
            <section key="teachers" id="teachers" className={bandClass}>
              <div className="mx-auto max-w-6xl px-4">
                <SectionHeader
                  index={num}
                  icon={<Users size={22} />}
                  eyebrow="আমাদের শিক্ষকবৃন্দ"
                  title="শিক্ষকবৃন্দ"
                  accentSolid={accentSolid}
                  accentLabel={accentLabel}
                  onAccent={onAccent}
                />
                {teachers.length ? (
                  <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {teachers.map((teacher: any) => (
                      <div
                        key={teacher.id}
                        className="overflow-hidden rounded-2xl border border-slate-100 bg-white text-center shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                      >
                        <div className="h-1.5" style={{ backgroundColor: accentSolid }} />
                        <div className="p-5">
                          <div
                            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold"
                            style={{ backgroundColor: accentSolid, color: onAccent }}
                          >
                            {initials(teacher.name || teacher.teacher_name)}
                          </div>
                          <div className="mt-3 font-bold text-slate-900">
                            {teacher.name || teacher.teacher_name}
                          </div>
                          <div className="mt-1 text-xs font-medium text-slate-500">
                            {teacher.designation || teacher.subject || "Teacher"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-8 text-center text-sm text-slate-500">
                    শিক্ষক তথ্য এখনো প্রকাশ করা হয়নি।
                  </p>
                )}
              </div>
            </section>
          );
        }

        if (key === "committee") {
          return (
            <section key="committee" id="committee" className={bandClass}>
              <div className="mx-auto max-w-6xl px-4">
                <SectionHeader
                  index={num}
                  icon={<UsersRound size={22} />}
                  eyebrow="পরিচালনা পর্ষদ"
                  title="মাদ্রাসা কমিটি"
                  accentSolid={accentSolid}
                  accentLabel={accentLabel}
                  onAccent={onAccent}
                />
                <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {committee.map((member: any) => (
                    <div
                      key={member.id}
                      className="overflow-hidden rounded-2xl border border-slate-100 bg-white text-center shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                    >
                      <div className="h-1.5" style={{ backgroundColor: accentSolid }} />
                      <div className="p-5">
                        {member.photo_url ? (
                          <img
                            src={member.photo_url}
                            alt={member.name}
                            loading="lazy"
                            decoding="async"
                            className="mx-auto h-16 w-16 rounded-full object-cover"
                          />
                        ) : (
                          <div
                            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold"
                            style={{ backgroundColor: accentSolid, color: onAccent }}
                          >
                            {initials(member.name)}
                          </div>
                        )}
                        <div className="mt-3 font-bold text-slate-900">{member.name}</div>
                        <div className="mt-1 text-xs font-medium text-slate-500">
                          {member.designation || "Committee Member"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          );
        }

        if (key === "gallery") {
          return (
            <section key="gallery" id="gallery" className={bandClass}>
              <div className="mx-auto max-w-6xl px-4">
                <SectionHeader
                  index={num}
                  icon={<ImageIcon size={22} />}
                  eyebrow="আমাদের মুহূর্তগুলো"
                  title="গ্যালারি"
                  accentSolid={accentSolid}
                  accentLabel={accentLabel}
                  onAccent={onAccent}
                />
                {gallery.length ? (
                  <div
                    ref={galleryGridRef}
                    className={`gallery-grid mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 ${
                      galleryInView ? "in-view" : ""
                    }`}
                  >
                    {gallery.map((item: any, idx: number) => (
                      <button
                        type="button"
                        key={item.id || item.image_url}
                        onClick={() => setLightbox({ url: item.image_url, title: item.title || "Gallery" })}
                        className="gallery-item group relative aspect-square overflow-hidden rounded-2xl shadow-sm transition-shadow duration-300 hover:shadow-xl"
                        style={{ transitionDelay: `${(idx % 12) * 60}ms` }}
                      >
                        <div
                          className="gallery-img-wrap h-full w-full"
                          style={{ animationDelay: `${(idx % 4) * 0.6}s` }}
                        >
                          <img
                            src={item.image_url}
                            alt={item.title || "Gallery"}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-110"
                          />
                        </div>
                        <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/30" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-8 text-center text-sm text-slate-500">
                    Gallery section চালু আছে। ছবি upload করলে এখানে দেখা যাবে।
                  </p>
                )}
              </div>
            </section>
          );
        }

        if (key === "notices") {
          return (
            <section key="notices" id="notices" className={bandClass}>
              <div className="mx-auto max-w-3xl px-4">
                <SectionHeader
                  index={num}
                  icon={<Bell size={22} />}
                  eyebrow="সর্বশেষ"
                  title="নোটিশ বোর্ড"
                  accentSolid={accentSolid}
                  accentLabel={accentLabel}
                  onAccent={onAccent}
                />
                {notices.length ? (
                  <div className="mt-10 space-y-4">
                    {notices.map((notice: any) => (
                      <div
                        key={notice.id}
                        className="rounded-2xl border border-slate-100 bg-white p-5 pl-6 shadow-sm"
                        style={{ borderLeft: `4px solid ${accentSolid}` }}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="font-bold text-slate-900">{notice.title}</h3>
                          <div className="flex items-center gap-2">
                            {isRecent(notice.published_at) && (
                              <span
                                className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                                style={{ backgroundColor: accentSolid, color: onAccent }}
                              >
                                নতুন
                              </span>
                            )}
                            {notice.published_at && (
                              <span className="text-xs font-medium text-slate-400">
                                {formatDate(notice.published_at)}
                              </span>
                            )}
                          </div>
                        </div>
                        {notice.content && (
                          <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-600">
                            {notice.content}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-8 text-center text-sm text-slate-500">No notices published.</p>
                )}
              </div>
            </section>
          );
        }

        if (key === "contact") {
          return (
            <section key="contact" id="contact" className={bandClass}>
              <div className="mx-auto max-w-4xl px-4">
                <SectionHeader
                  index={num}
                  icon={<Mail size={22} />}
                  eyebrow="যোগাযোগ"
                  title={pageMap.contact?.title || "যোগাযোগ"}
                  accentSolid={accentSolid}
                  accentLabel={accentLabel}
                  onAccent={onAccent}
                />
                {pageMap.contact?.content && (
                  <p className="mx-auto mt-6 max-w-2xl whitespace-pre-line text-center text-sm leading-7 text-slate-600">
                    {pageMap.contact.content}
                  </p>
                )}
                <div className="mt-10 grid gap-4 sm:grid-cols-3">
                  {[
                    {
                      icon: <Phone size={18} />,
                      label: "Phone",
                      value: madrasa?.phone,
                      href: madrasa?.phone ? `tel:${madrasa.phone}` : undefined,
                      external: false,
                    },
                    {
                      icon: <Mail size={18} />,
                      label: "Email",
                      value: madrasa?.email,
                      href: madrasa?.email ? `mailto:${madrasa.email}` : undefined,
                      external: false,
                    },
                    {
                      icon: <MapPin size={18} />,
                      label: "Address",
                      value: madrasa?.address,
                      href: mapsUrl || undefined,
                      external: true,
                    },
                  ]
                    .filter((row) => row.value)
                    .map((row) => (
                      <a
                        key={row.label}
                        href={row.href}
                        target={row.external ? "_blank" : undefined}
                        rel={row.external ? "noreferrer" : undefined}
                        className="flex flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                      >
                        <span
                          className="flex h-11 w-11 items-center justify-center rounded-xl"
                          style={{ backgroundColor: accentSolid, color: onAccent }}
                        >
                          {row.icon}
                        </span>
                        <span className="text-xs font-semibold uppercase text-slate-400">{row.label}</span>
                        <span className="text-sm font-bold text-slate-800">{row.value}</span>
                      </a>
                    ))}
                </div>
              </div>
            </section>
          );
        }

        return null;
      })}

      {/* Footer */}
      <footer className="relative bg-slate-950 text-slate-300">
        <div className="h-1 w-full" style={{ backgroundColor: accentSolid }} />

        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {/* Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3">
                {madrasa?.logo_url ? (
                  <img
                    src={madrasa?.logo_url}
                    alt="Logo"
                    className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-white/10"
                  />
                ) : (
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                    style={{ backgroundColor: accentSolid, color: onAccent }}
                  >
                    {initials(madrasa?.name)}
                  </div>
                )}
                <span className="break-words text-lg font-extrabold leading-tight text-white">
                  {madrasa?.name}
                </span>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-400">
                {settings.hero_subtitle || madrasa?.address || "একটি ইসলামিক শিক্ষা প্রতিষ্ঠান।"}
              </p>

              {(settings.facebook_url ||
                settings.youtube_url ||
                settings.instagram_url ||
                settings.whatsapp_channel_url) && (
                <div className="mt-5 flex items-center gap-2.5">
                  {[
                    settings.facebook_url && { href: settings.facebook_url, label: "Facebook", icon: <Facebook size={16} /> },
                    settings.youtube_url && { href: settings.youtube_url, label: "YouTube", icon: <Youtube size={16} /> },
                    settings.instagram_url && { href: settings.instagram_url, label: "Instagram", icon: <Instagram size={16} /> },
                    settings.whatsapp_channel_url && {
                      href: settings.whatsapp_channel_url,
                      label: "WhatsApp",
                      icon: <WhatsAppIcon size={16} />,
                    },
                  ]
                    .filter(Boolean)
                    .map((social: any) => (
                      <a
                        key={social.label}
                        href={social.href}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={social.label}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-slate-300 ring-1 ring-white/10 transition duration-200 hover:-translate-y-1 hover:bg-[var(--accent)] hover:text-white"
                        style={{ ["--accent" as any]: accentSolid }}
                      >
                        {social.icon}
                      </a>
                    ))}
                </div>
              )}
            </div>

            {/* Quick links */}
            {visibleSections.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-white">প্রয়োজনীয় লিংক</h3>
                <span className="mt-2 block h-0.5 w-8 rounded-full" style={{ backgroundColor: accentSolid }} />
                <nav className="mt-4 flex flex-col gap-2.5 text-sm text-slate-400">
                  {visibleSections.map((key) => (
                    <a key={key} href={`#${key}`} className="w-fit transition hover:text-white">
                      {NAV_LABELS[key]}
                    </a>
                  ))}
                </nav>
              </div>
            )}

            {/* Contact */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-white">যোগাযোগ</h3>
              <span className="mt-2 block h-0.5 w-8 rounded-full" style={{ backgroundColor: accentSolid }} />
              <div className="mt-4 flex flex-col gap-3 text-sm text-slate-400">
                {madrasa?.phone && (
                  <a href={`tel:${madrasa.phone}`} className="flex items-start gap-2.5 transition hover:text-white">
                    <Phone size={16} className="mt-0.5 shrink-0" style={{ color: accentLabel }} />
                    <span>{madrasa.phone}</span>
                  </a>
                )}
                {madrasa?.email && (
                  <a
                    href={`mailto:${madrasa.email}`}
                    className="flex items-start gap-2.5 break-all transition hover:text-white"
                  >
                    <Mail size={16} className="mt-0.5 shrink-0" style={{ color: accentLabel }} />
                    <span>{madrasa.email}</span>
                  </a>
                )}
                {madrasa?.address && (
                  <a
                    href={mapsUrl || undefined}
                    target={mapsUrl ? "_blank" : undefined}
                    rel="noreferrer"
                    className="flex items-start gap-2.5 transition hover:text-white"
                  >
                    <MapPin size={16} className="mt-0.5 shrink-0" style={{ color: accentLabel }} />
                    <span>{madrasa.address}</span>
                  </a>
                )}
              </div>
            </div>

            {/* CTA */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-white">অভিভাবক ও ভর্তি</h3>
              <span className="mt-2 block h-0.5 w-8 rounded-full" style={{ backgroundColor: accentSolid }} />
              <div className="mt-4 flex flex-col gap-2.5">
                <Link
                  to={admissionUrl}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm transition hover:opacity-90"
                  style={{ backgroundColor: accentSolid, color: onAccent }}
                >
                  অনলাইনে ভর্তি
                </Link>
                <Link
                  to={guardianLoginUrl}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-white/5"
                >
                  অভিভাবক লগইন
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-center sm:flex-row sm:text-left">
            <p className="text-xs text-slate-500">
              &copy; {new Date().getFullYear()} {madrasa?.name}. সর্বস্বত্ব সংরক্ষিত।
            </p>
            <p className="text-xs text-slate-500">Official Website</p>
          </div>
        </div>
      </footer>

      {/* Back to top */}
      {showTop && (
        <a
          href="#top"
          className="fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition hover:opacity-90"
          style={{ backgroundColor: accentSolid, color: onAccent }}
          aria-label="Back to top"
        >
          <ChevronUp size={20} />
        </a>
      )}

      {/* Floating WhatsApp button */}
      {madrasa?.phone && (
        <a
          href={waLink(madrasa.phone)}
          target="_blank"
          rel="noreferrer"
          aria-label="WhatsApp এ চ্যাট করুন"
          className="fixed bottom-6 left-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20 transition hover:scale-110"
        >
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#25D366] opacity-75" />
          <WhatsAppIcon size={28} />
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
            className="absolute right-5 top-5 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Close"
          >
            <X size={22} />
          </button>
          <img
            src={lightbox.url}
            alt={lightbox.title}
            className="animate-lightboxImage max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
