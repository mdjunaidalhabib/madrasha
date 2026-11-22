import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen,
  CalendarDays,
  CalendarCheck,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Megaphone,
  ShieldCheck,
  UserRound,
  Wallet,
  X,
  ChevronDown,
} from "lucide-react";
import guardianApi from "../services/guardianApi";
import { useGuardianAuthStore } from "../store/guardianAuthStore";
import { getTenantGuardianBase } from "../utils/tenantSlug";
import { useTenantSlug } from "../utils/useTenantSlug";
import RouteErrorBoundary from "@madrasha/shared-ui/src/components/ui/RouteErrorBoundary";
import PageNavBar from "@madrasha/shared-ui/src/navigation/PageNavBar";
import {
  useRefreshStore,
  useRegisterRefresher,
} from "@madrasha/shared-ui/src/navigation/refreshStore";
import { LanguageSwitcher, localizeDigits, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { guardianText } from "../features/guardian/guardian.text";
import { useGuardianBrand } from "../features/guardian/useGuardianBrand";
import { useGuardianLightTheme } from "../features/guardian/useGuardianLightTheme";
import GuardianAppInstall from "../features/guardian/GuardianAppInstall";
import "../features/guardian/guardian.css";

const NAV_ITEMS = [
  { to: "dashboard", icon: LayoutDashboard },
  { to: "profile", icon: UserRound },
  { to: "attendance", icon: CalendarCheck },
  { to: "leave", icon: ClipboardList },
  { to: "results", icon: GraduationCap },
  { to: "exam-routine", icon: CalendarDays },
  { to: "fees", icon: Wallet },
  { to: "notices", icon: Megaphone },
];

export default function GuardianLayout() {
  useGuardianLightTheme();
  const t = useText(guardianText);
  const lang = useLang();
  const slug = useTenantSlug();
  const base = getTenantGuardianBase(slug);
  const brand = useGuardianBrand(slug);
  const nav = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const guardian = useGuardianAuthStore((s) => s.guardian);
  const children = useGuardianAuthStore((s) => s.children);
  const selectedStudentId = useGuardianAuthStore((s) => s.selectedStudentId);
  const setChildren = useGuardianAuthStore((s) => s.setChildren);
  const selectStudent = useGuardianAuthStore((s) => s.selectStudent);
  const logout = useGuardianAuthStore((s) => s.logout);
  const child = children.find((item) => item.id === selectedStudentId);
  const loadChildren = useCallback(async () => {
    const res = await guardianApi.get("/guardian/me/children");
    setChildren(res.data?.data || []);
  }, [setChildren]);
  useEffect(() => {
    void loadChildren().catch(() => {});
  }, [loadChildren]);
  useRegisterRefresher(loadChildren);
  const refreshKey = useRefreshStore((s) => s.refreshKey);
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setMenuOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebar.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
      if (event.key === "Tab") {
        const items = sidebar.current?.querySelectorAll<HTMLElement>("a[href], button, select");
        if (!items?.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);
  const breadcrumbs = useMemo(() => {
    const home = { label: t.home, to: `${base}/dashboard` };
    if (location.pathname.startsWith(`${base}/results/`))
      return [home, { label: t.nav.results, to: `${base}/results` }, { label: t.marksheet }];
    const current = NAV_ITEMS.find((item) => location.pathname === `${base}/${item.to}`);
    return [home, { label: t.nav[current?.to || "dashboard"] }];
  }, [base, location.pathname, t]);
  return (
    <div className="guardian-portal">
      <a className="guardian-skip" href="#guardian-content">
        {t.workspace}
      </a>
      {menuOpen && (
        <button
          className="guardian-backdrop"
          aria-label={t.closeMenu}
          onClick={() => {
            setMenuOpen(false);
            menuButton.current?.focus();
          }}
        />
      )}
      <aside
        ref={sidebar}
        id="guardian-navigation"
        className={`guardian-sidebar ${menuOpen ? "is-open" : ""}`}
        aria-label={t.panelTitle}
      >
        <div className="guardian-brand">
          <span className="guardian-brand-icon">
            {brand?.logo_url ? <img className="guardian-institution-logo" src={brand.logo_url} alt="" /> : <BookOpen size={25} strokeWidth={1.6} />}
          </span>
          <div>
            <strong>{t.panelTitle}</strong>
          </div>
          <button
            className="guardian-menu-close"
            onClick={() => {
              setMenuOpen(false);
              menuButton.current?.focus();
            }}
            aria-label={t.closeMenu}
          >
            <X size={21} />
          </button>
        </div>
        <p className="guardian-nav-label">{t.workspace}</p>
        <nav className="guardian-nav" aria-label={t.workspace}>
          {NAV_ITEMS.map(({ to, icon: Icon }) => (
            <NavLink
              key={to}
              to={`${base}/${to}`}
              className={({ isActive }) => `guardian-nav-item ${isActive ? "is-active" : ""}`}
            >
              <Icon size={20} strokeWidth={1.7} />
              <span>{t.nav[to]}</span>
            </NavLink>
          ))}
        </nav>
        <GuardianAppInstall slug={slug} variant="sidebar" />
        <div className="guardian-sidebar-note">
          <GraduationCap size={30} strokeWidth={1.3} />
          <strong>{t.learningTogether}</strong>
          <p>{t.familySpace}</p>
        </div>
        <div className="guardian-account">
          <span className="guardian-avatar">
            {(guardian?.name || guardian?.phone || "G").slice(0, 1)}
          </span>
          <div>
            <strong>{guardian?.name || t.panelTitle}</strong>
            <span>{localizeDigits(guardian?.phone || "", lang)}</span>
          </div>
          <button
            title={t.logout}
            aria-label={t.logout}
            onClick={() => {
              logout();
              nav(`${base}/login`);
            }}
          >
            <LogOut size={19} />
          </button>
        </div>
      </aside>
      <div className="guardian-workspace">
        <header className="guardian-topbar">
          <div className="guardian-topbar-title">
            <button
              ref={menuButton}
              className="guardian-menu-button"
              aria-label={t.menu}
              aria-expanded={menuOpen}
              aria-controls="guardian-navigation"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <Menu size={22} />
            </button>
            <div>
              <strong>
                {brand?.name || t.panelTitle}
                {brand?.address && (
                  <span> · {brand.address}</span>
                )}
              </strong>
              <p>{t.welcome}{guardian?.name ? `, ${guardian.name}` : ""}</p>
            </div>
          </div>
          <div className="guardian-topbar-actions">
            {children.length > 1 && (
              <div className="guardian-child-select">
                <UserRound size={17} />
                <select
                  aria-label={t.selectChild}
                  value={selectedStudentId ?? ""}
                  onChange={(e) => selectStudent(Number(e.target.value))}
                >
                  {children.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nameBn}
                      {item.className ? ` (${item.className})` : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown size={15} />
              </div>
            )}
            <LanguageSwitcher />
            <Link
              to={`${base}/notices`}
              className="guardian-notice-button"
              title={t.notices}
              aria-label={t.notices}
            >
              <Megaphone size={20} />
            </Link>
          </div>
        </header>
        <main id="guardian-content" className="guardian-content" tabIndex={-1}>
          <div className="guardian-breadcrumbs">
            <PageNavBar breadcrumbs={breadcrumbs} />
          </div>
          <RouteErrorBoundary key={`${location.pathname}:${refreshKey}`}>
            <Outlet key={selectedStudentId} />
          </RouteErrorBoundary>
        </main>
        <footer className="guardian-footer">
          <span>
            <ShieldCheck size={16} />
            {t.panelTitle}
          </span>
          <span>{child?.nameBn || t.learningTogether}</span>
        </footer>
      </div>
      <nav className="guardian-mobile-nav" aria-label={t.workspace}>
        {NAV_ITEMS.filter((item) =>
          ["dashboard", "attendance", "results", "fees"].includes(item.to),
        ).map(({ to, icon: Icon }) => (
          <NavLink
            key={to}
            to={`${base}/${to}`}
            className={({ isActive }) => (isActive ? "is-active" : "")}
          >
            <Icon size={21} />
            <span>{t.nav[to]}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
