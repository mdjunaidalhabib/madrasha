import { useEffect, useState, type ReactNode } from "react";
import {
  GraduationCap,
  Users,
  UserPlus,
  CalendarCheck,
  ClipboardList,
  Wallet,
  BarChart3,
  MessageSquareText,
  Settings,
  Clock,
  ShieldCheck,
  LayoutDashboard,
  Users2,
  Phone,
  Mail,
  MapPin,
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  PlayCircle,
  Wrench,
  Rocket,
  PhoneCall,
  Menu,
  X,
} from "lucide-react";
import ContactFab from "./ContactFab";
import { getAdminAppLoginUrl } from "../../utils/adminAppUrl";
import { LanguageSwitcher, localizeDigits, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { landingText } from "./landing.text";

// Contact number used for both the "tel:" and WhatsApp ("wa.me") links in
// the floating contact button and the Contact section below. Kept in one
// place so both stay in sync.
const CONTACT_PHONE_DISPLAY = "01624114405";
const CONTACT_PHONE_INTL = "8801624114405"; // wa.me needs country code, no "+" or leading 0

// Labels come from landingText.nav[key].
const NAV_LINKS = [
  { href: "#about", key: "about" },
  { href: "#why", key: "why" },
  { href: "#getting-started", key: "gettingStarted" },
  { href: "#service", key: "service" },
  { href: "#contact", key: "contact" },
];

const FEATURE_ICONS = [Users, Users2, UserPlus, CalendarCheck, ClipboardList, Wallet, BarChart3, MessageSquareText, Settings];
const WHY_ICONS = [Clock, ShieldCheck, BarChart3, ShieldCheck, LayoutDashboard, Users2];
const STEP_ICONS = [UserPlus, Settings, Users2, ClipboardList, LayoutDashboard];
const SERVICE_ICONS = [PhoneCall, PlayCircle, Wrench, FileCheck2, Rocket];
const MOCK_ICONS = [Users, Users2, UserPlus, CalendarCheck, ClipboardList, Wallet];

/* ---------------------------------------------------------
   Design tokens for this page:
   - ink        #0b1220  (deep navy-black hero surface)
   - emerald    #059669  (primary brand — trust / growth)
   - emerald-dk #047857
   - gold       #c98a2c  (muted calligraphic accent, used sparingly)
   - surface    slate-50 / white cards on light sections
--------------------------------------------------------- */

function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-600/20 bg-emerald-50 px-4 py-1.5 text-xs font-semibold tracking-wide text-emerald-700">
      {children}
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: ReactNode; title: string; desc: string }) {
  return (
    <div className="group rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white">
        {icon}
      </div>
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      <p className="mt-1.5 text-sm leading-6 text-slate-600">{desc}</p>
    </div>
  );
}

function WhyCard({ icon, title, desc }: { icon: ReactNode; title: string; desc: string }) {
  return (
    <div className="flex gap-4 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
        {icon}
      </div>
      <div>
        <h3 className="font-bold text-white">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-300">{desc}</p>
      </div>
    </div>
  );
}

function StepItem({
  index,
  icon,
  title,
  desc,
  isLast,
}: {
  index: string;
  icon: ReactNode;
  title: string;
  desc: string;
  isLast?: boolean;
}) {
  const t = useText(landingText);
  return (
    <div className="relative flex gap-5">
      <div className="flex flex-col items-center">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-600 font-bold text-white shadow-md shadow-emerald-600/20">
          {icon}
        </div>
        {!isLast && <div className="mt-2 w-px flex-1 bg-emerald-200" />}
      </div>
      <div className="pb-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
          {t.step(index)}
        </p>
        <h3 className="mt-1 text-lg font-bold text-slate-900">{title}</h3>
        <p className="mt-1.5 max-w-xl text-sm leading-6 text-slate-600">{desc}</p>
      </div>
    </div>
  );
}

export default function QmsLandingPage() {
  const t = useText(landingText);
  const lang = useLang();
  const adminAppLoginUrl = getAdminAppLoginUrl();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Tracks which section is currently in view so the matching nav link can
  // be highlighted (scrollspy). Defaults to the first nav link's section.
  const [activeSection, setActiveSection] = useState(NAV_LINKS[0].href.slice(1));

  useEffect(() => {
    const sectionIds = NAV_LINKS.map((link) => link.href.slice(1));
    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Among sections currently intersecting the "active band" near the
        // top of the viewport, pick the one closest to the top.
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length > 0) {
          setActiveSection(visible[0].target.id);
        }
      },
      // Treat a horizontal band just below the sticky header as "active":
      // a section is counted as current once it reaches that band and
      // until it scrolls past it.
      { rootMargin: "-88px 0px -70% 0px", threshold: 0 },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="min-h-screen bg-white text-slate-900 antialiased"
      style={{ fontFamily: "var(--font-ui-bn)" }}
    >
      {/* ---------------- Header ---------------- */}
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <a href="#top" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <GraduationCap size={20} />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-extrabold tracking-tight text-slate-900">
                QMS
              </span>
              <span className="block text-[11px] text-slate-500">Qawmi Madrasa System</span>
            </span>
          </a>

          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            {NAV_LINKS.map((link) => {
              const isActive = activeSection === link.href.slice(1);
              return (
                <a
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "true" : undefined}
                  className={`transition hover:text-emerald-700 ${
                    isActive ? "font-semibold text-emerald-700" : ""
                  }`}
                >
                  {t.nav[link.key]}
                </a>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <a
              href={adminAppLoginUrl}
              className="hidden items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700 sm:inline-flex"
            >
              {t.goToAdmin}
              <ArrowRight size={15} className="rtl:rotate-180" />
            </a>

            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label={mobileNavOpen ? t.closeMenu : t.openMenu}
              aria-expanded={mobileNavOpen}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-50 md:hidden"
            >
              {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile nav panel */}
        {mobileNavOpen && (
          <div className="border-t border-slate-100 bg-white px-4 py-3 md:hidden">
            <nav className="flex flex-col gap-1 text-sm font-medium text-slate-600">
              {NAV_LINKS.map((link) => {
                const isActive = activeSection === link.href.slice(1);
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileNavOpen(false)}
                    aria-current={isActive ? "true" : undefined}
                    className={`rounded-lg px-3 py-2.5 transition hover:bg-emerald-50 hover:text-emerald-700 ${
                      isActive ? "bg-emerald-50 font-semibold text-emerald-700" : ""
                    }`}
                  >
                    {t.nav[link.key]}
                  </a>
                );
              })}
              <a
                href={adminAppLoginUrl}
                onClick={() => setMobileNavOpen(false)}
                className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700"
              >
                {t.goToAdmin}
                <ArrowRight size={15} className="rtl:rotate-180" />
              </a>
            </nav>
          </div>
        )}
      </header>

      {/* ---------------- Hero ---------------- */}
      <section id="top" className="relative overflow-hidden bg-[#0b1220]">
        {/* subtle geometric backdrop */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -end-40 -top-40 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -start-32 bottom-0 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl"
        />

        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-8 sm:px-6 sm:py-16 lg:grid-cols-2 lg:items-center lg:py-28">
          <div>
            <h1 className="text-2xl font-extrabold leading-[1.25] tracking-tight text-white sm:text-4xl sm:leading-[1.15] lg:text-5xl">
              {t.heroLine1}
              <span className="block text-emerald-400">{t.heroLine2}</span>
            </h1>

            <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
              {t.heroBody}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#service"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500"
              >
                {t.getService}
                <ArrowRight size={16} className="rtl:rotate-180" />
              </a>
              <a
                href="#about"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/5"
              >
                {t.learnMore}
              </a>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-400">
              {t.badges.map((badge) => (
                <div key={badge} className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  {badge}
                </div>
              ))}
            </div>
          </div>

          {/* Product glimpse: module grid mock */}
          <div className="relative">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur-sm sm:p-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                </div>
                <span className="text-[11px] font-medium text-slate-400">
                  qms.hikmahit.com/dashboard
                </span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {t.mockModules.map((label, i) => {
                  const Icon = MOCK_ICONS[i];
                  return { icon: <Icon size={18} />, label };
                }).map((m) => (
                  <div
                    key={m.label}
                    className="rounded-xl bg-white/[0.06] p-4 text-slate-200 ring-1 ring-white/5"
                  >
                    <div className="text-emerald-400">{m.icon}</div>
                    <p className="mt-3 text-xs font-semibold">{m.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute -bottom-5 -start-5 hidden rounded-2xl bg-emerald-600 px-4 py-3 text-white shadow-xl sm:block">
              <p className="text-[11px] font-medium text-emerald-100">{t.resultReady}</p>
              <p className="text-sm font-bold">{t.oneClickReport}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- About QMS ---------------- */}
      <section id="about" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <SectionEyebrow>{t.aboutEyebrow}</SectionEyebrow>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900">
            {t.aboutTitle}
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            {t.aboutBody}
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {t.features.map((card, i) => {
            const Icon = FEATURE_ICONS[i];
            return <FeatureCard key={card.title} icon={<Icon size={20} />} title={card.title} desc={card.desc} />;
          })}
        </div>
      </section>

      {/* ---------------- Why Choose QMS ---------------- */}
      <section id="why" className="relative overflow-hidden bg-[#0b1220] py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute end-0 top-0 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl"
        />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-emerald-300">
              {t.whyEyebrow}
            </div>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white">
              {t.whyTitle}
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {t.why.map((card, i) => {
              const Icon = WHY_ICONS[i];
              return <WhyCard key={card.title} icon={<Icon size={20} />} title={card.title} desc={card.desc} />;
            })}
          </div>
        </div>
      </section>

      {/* ---------------- Getting Started ---------------- */}
      <section id="getting-started" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <SectionEyebrow>{t.startEyebrow}</SectionEyebrow>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900">
            {t.startTitle}
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            {t.startBody}
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-2xl">
          {t.steps.map((step, i) => {
            const Icon = STEP_ICONS[i];
            return (
              <StepItem
                key={step.title}
                index={localizeDigits(i + 1, lang)}
                icon={<Icon size={18} />}
                title={step.title}
                desc={step.desc}
                isLast={i === t.steps.length - 1}
              />
            );
          })}
        </div>
      </section>

      {/* ---------------- How to Get This Service ---------------- */}
      <section id="service" className="bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <SectionEyebrow>{t.serviceEyebrow}</SectionEyebrow>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900">
              {t.serviceTitle}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {t.serviceBody}
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {t.service.map((card, i) => {
              const Icon = SERVICE_ICONS[i];
              return { ...card, icon: <Icon size={20} /> };
            }).map((s, i) => (
              <div
                key={s.title}
                className="relative rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
              >
                <span className="absolute end-4 top-4 text-2xl font-extrabold text-slate-100">
                  {localizeDigits(i + 1, lang)}
                </span>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  {s.icon}
                </div>
                <h3 className="mt-4 text-sm font-bold text-slate-900">{s.title}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-600">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <a
              href="#contact"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700"
            >
              {t.contactNow}
              <ArrowRight size={16} className="rtl:rotate-180" />
            </a>
          </div>
        </div>
      </section>

      {/* ---------------- Contact ---------------- */}
      <section id="contact" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="overflow-hidden rounded-3xl bg-[#0b1220]">
          <div className="grid grid-cols-1 lg:grid-cols-5">
            <div className="p-8 sm:p-10 lg:col-span-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/20">
                {t.contactEyebrow}
              </div>
              <h2 className="mt-4 text-2xl font-extrabold text-white">Hikmah IT</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {t.contactBody}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-px bg-white/10 sm:grid-cols-3 lg:col-span-3">
              <a
                href={`tel:${CONTACT_PHONE_DISPLAY}`}
                className="flex flex-col gap-3 bg-[#0b1220] p-8 transition hover:bg-white/[0.03]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                  <Phone size={18} />
                </span>
                <span className="text-xs font-medium text-slate-400">{t.phone}</span>
                <span className="text-sm font-semibold text-white" dir="ltr">
                  {CONTACT_PHONE_DISPLAY}
                </span>
              </a>
              <a
                href="mailto:hikmahitcenter@gmail.com"
                className="flex flex-col gap-3 bg-[#0b1220] p-8 transition hover:bg-white/[0.03]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                  <Mail size={18} />
                </span>
                <span className="text-xs font-medium text-slate-400">{t.email}</span>
                <span className="break-all text-sm font-semibold text-white">
                  hikmahitcenter@gmail.com
                </span>
              </a>
              <div className="flex flex-col gap-3 bg-[#0b1220] p-8">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                  <MapPin size={18} />
                </span>
                <span className="text-xs font-medium text-slate-400">{t.address}</span>
                <span className="text-sm font-semibold text-white">
                  {t.addressValue}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Footer ---------------- */}
      <footer className="border-t border-slate-100 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <div className="flex flex-col items-center gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-2">
              <a
                href="#top"
                className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-white"
              >
                <GraduationCap size={14} />
              </a>
              <span className="text-sm">
                <a
                  href="#top"
                  className="font-semibold text-slate-700 transition hover:text-emerald-700"
                >
                  QMS
                </a>{" "}
                {t.poweredBy}{" "}
                <a
                  href="https://hikmahit.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold transition text-emerald-600 hover:text-emerald-500"
                >
                  Hikmah IT
                </a>
              </span>
            </div>

            <p>
              &copy; {localizeDigits(new Date().getFullYear(), lang)}{" "}
              <a
                href="https://hikmahit.com"
                target="_blank"
                rel="noopener noreferrer"
                className="transition text-emerald-600 hover:text-emerald-500"
              >
                Hikmah IT
              </a>
              . {t.allRightsReserved}
            </p>
          </div>
        </div>
      </footer>

      <ContactFab phoneDisplay={CONTACT_PHONE_DISPLAY} phoneIntl={CONTACT_PHONE_INTL} />
    </div>
  );
}
