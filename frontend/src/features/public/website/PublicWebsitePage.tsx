import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Bell,
  ChevronUp,
  GraduationCap,
  Image as ImageIcon,
  Info,
  Loader2,
  Mail,
  MapPin,
  Menu,
  Phone,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { getPublicWebsite } from "../../../services/websiteApi";
import { getTenantGuardianBase } from "../../../utils/tenantSlug";

const NAV_LABELS: Record<string, string> = {
  about: "পরিচিতি",
  admission: "ভর্তি তথ্য",
  teachers: "শিক্ষকবৃন্দ",
  gallery: "গ্যালারি",
  notices: "নোটিশ",
  contact: "যোগাযোগ",
};

// --- Color system -----------------------------------------------------
// The theme color is an arbitrary hex an admin picks from a plain color
// input, so it can land anywhere from a deep navy to a pale pastel. Using
// it directly as text-on-white or as a solid badge fill (as a first pass
// did) made labels/badges/buttons wash out or vanish whenever an admin
// chose a light color. Every brand-colored surface below now goes through
// one of these helpers so text always stays legible regardless of the
// picked color.

function hexToRgb(hex: string) {
  let c = (hex || "").replace("#", "");
  if (c.length === 3)
    c = c
      .split("")
      .map((ch) => ch + ch)
      .join("");
  const num = parseInt(c, 16);
  if (!c || Number.isNaN(num)) return { r: 37, g: 99, b: 235 };
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHex(r: number, g: number, b: number) {
  const h = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function withAlpha(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function relativeLuminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function mixHex(hexA: string, hexB: string, t: number) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return rgbToHex(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
}

/** Darkened just enough to stay a solid, confident badge/button/icon fill. */
function accentStrong(hex: string) {
  let color = hex;
  let guard = 0;
  while (relativeLuminance(color) > 0.42 && guard < 8) {
    color = mixHex(color, "#000000", 0.16);
    guard++;
  }
  return color;
}

/** Darkened just enough to read clearly as text/label color on a white card. */
function accentText(hex: string) {
  let color = hex;
  let guard = 0;
  while (relativeLuminance(color) > 0.38 && guard < 8) {
    color = mixHex(color, "#000000", 0.14);
    guard++;
  }
  return color;
}

function pickTextOn(hex: string) {
  return relativeLuminance(hex) > 0.5 ? "#0f172a" : "#ffffff";
}

function initials(name?: string) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "M";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

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

  const visibleSections = useMemo(() => {
    const s = data?.settings || {};
    const list: string[] = [];
    if (s.show_about !== 0 && pageMap.about) list.push("about");
    if (s.show_admission !== 0 && pageMap.admission) list.push("admission");
    if (s.show_teachers !== 0) list.push("teachers");
    if (s.show_gallery !== 0) list.push("gallery");
    if (s.show_notices !== 0) list.push("notices");
    if (s.show_contact !== 0) list.push("contact");
    return list;
  }, [data, pageMap]);

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
        className={`fixed inset-x-0 top-0 z-50 border-b bg-white transition-shadow ${
          scrolled ? "border-slate-100 shadow-sm" : "border-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <a href="#top" className="flex min-w-0 items-center gap-3">
            {settings.logo_url ? (
              <img
                src={settings.logo_url}
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
              <div className="truncate text-base font-extrabold leading-tight text-slate-900">
                {madrasa?.name}
              </div>
              <div className="text-[11px] font-medium text-slate-400">Official Website</div>
            </div>
          </a>

          <nav className="hidden items-center gap-1 lg:flex">
            {visibleSections.map((key) => (
              <a
                key={key}
                href={`#${key}`}
                className="rounded-full px-3.5 py-2 text-sm font-semibold transition"
                style={
                  activeId === key
                    ? { color: onAccent, backgroundColor: accentSolid }
                    : { color: "#334155" }
                }
              >
                {NAV_LABELS[key]}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            {madrasa?.phone && (
              <a
                href={`tel:${madrasa.phone}`}
                className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                <Phone size={15} />
                {madrasa.phone}
              </a>
            )}
            <Link
              to={guardianLoginUrl}
              className="rounded-xl px-4 py-2 text-sm font-bold shadow-sm transition hover:opacity-90"
              style={{ backgroundColor: accentSolid, color: onAccent }}
            >
              অভিভাবক লগইন
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-lg p-2 text-slate-700 lg:hidden"
            aria-label="Menu"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-slate-100 bg-white px-4 py-3 lg:hidden">
            <nav className="flex flex-col gap-1">
              {visibleSections.map((key) => (
                <a
                  key={key}
                  href={`#${key}`}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700"
                >
                  {NAV_LABELS[key]}
                </a>
              ))}
              <Link
                to={guardianLoginUrl}
                onClick={() => setMenuOpen(false)}
                className="mt-2 rounded-xl px-4 py-2.5 text-center text-sm font-bold"
                style={{ backgroundColor: accentSolid, color: onAccent }}
              >
                অভিভাবক লগইন
              </Link>
            </nav>
          </div>
        )}
      </header>

      {/* Hero */}
      <section
        id="top"
        className="relative overflow-hidden pb-28 pt-32 text-white md:pb-32 md:pt-40"
        style={{ background: `linear-gradient(135deg, ${accentSolid} 0%, #05070d 85%)` }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-black/15" />
        <div
          className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full blur-3xl"
          style={{ backgroundColor: withAlpha("#ffffff", 0.08) }}
        />
        <div
          className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full blur-3xl"
          style={{ backgroundColor: withAlpha(accentSolid, 0.45) }}
        />

        <div className="relative mx-auto max-w-4xl px-4 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white/90 ring-1 ring-white/20">
            <Sparkles size={13} />
            Official Madrasa Website
          </span>
          <h1 className="mt-5 text-3xl font-extrabold leading-tight md:text-5xl">
            {settings.hero_title || madrasa?.name}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-white/85 md:text-base">
            {settings.hero_subtitle || madrasa?.address || "Welcome to our madrasa website."}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to={guardianLoginUrl}
              className="rounded-xl bg-white px-6 py-3 text-sm font-bold shadow-lg transition hover:-translate-y-0.5"
              style={{ color: accentLabel }}
            >
              অভিভাবক লগইন
            </Link>
            {settings.show_admission !== 0 && pageMap.admission && (
              <a
                href="#admission"
                className="rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20"
              >
                ভর্তি তথ্য দেখুন
              </a>
            )}
          </div>

          {madrasa?.website_status === "limited" && (
            <div className="mx-auto mt-8 flex max-w-md items-center justify-center gap-2 rounded-xl bg-amber-400/15 px-4 py-3 text-xs font-semibold text-amber-200 ring-1 ring-amber-300/30">
              Limited mode enabled by Super Admin.
            </div>
          )}
        </div>
      </section>

      {/* Quick info strip */}
      <div className="relative z-10 mx-auto -mt-14 max-w-5xl px-4">
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
                  {settings.show_contact !== 0 && (
                    <a
                      href="#contact"
                      className="mt-6 inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-bold shadow-sm transition hover:opacity-90"
                      style={{ backgroundColor: accentSolid, color: onAccent }}
                    >
                      যোগাযোগ করুন
                    </a>
                  )}
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
                  <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {gallery.map((item: any) => (
                      <button
                        type="button"
                        key={item.id || item.image_url}
                        onClick={() => setLightbox({ url: item.image_url, title: item.title || "Gallery" })}
                        className="group relative aspect-square overflow-hidden rounded-2xl"
                      >
                        <img
                          src={item.image_url}
                          alt={item.title || "Gallery"}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-110"
                        />
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
      <footer className="bg-slate-950 py-10 text-slate-300">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 text-center">
          <div className="flex items-center gap-3">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold"
                style={{ backgroundColor: accentSolid, color: onAccent }}
              >
                {initials(madrasa?.name)}
              </div>
            )}
            <span className="text-base font-bold text-white">{madrasa?.name}</span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-slate-400">
            {visibleSections.map((key) => (
              <a key={key} href={`#${key}`} className="hover:text-white">
                {NAV_LABELS[key]}
              </a>
            ))}
          </nav>
          <p className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} {madrasa?.name}. All rights reserved.
          </p>
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

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
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
            className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
