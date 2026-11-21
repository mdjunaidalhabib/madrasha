import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useSidebarStore } from "../../store/sidebarStore";
import { useUIStore } from "../../store/uiStore";
import { useAuthStore } from "../../store/authStore";
import { useBrandingStore } from "../../store/brandingStore";
import { logoutSession } from "../../services/profileApi";
import { prefetchAdminRoute } from "../../app/routePrefetch";
import AdminSidebarShell from "@madrasha/shared-ui/src/components/shell/AdminSidebarShell";
import { Skeleton } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import ThemeToggle from "@madrasha/shared-ui/src/components/ui/ThemeToggle";
import { LanguageSwitcher, commonText, useText } from "@madrasha/shared-ui/src/i18n";
import { sidebarText, sidebarModuleLabel, sidebarChildLabel } from "./sidebar.text";
import { modulePath, childPath, matchSidebarPath } from "./sidebarPaths";
import PlanBadge from "../topbar/PlanBadge";
import LockButton from "../lock/LockButton";

import {
  LayoutDashboard,
  Folder,
  Wallet,
  BookOpen,
  Users,
  Settings,
  ClipboardList,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  MessageSquare,
  Library,
  CalendarCheck,
  GraduationCap,
  Receipt,
  X,
} from "lucide-react";

type SidebarProps = { closeSidebar?: () => void };

const ICONS: Record<string, any> = {
  dashboard: LayoutDashboard,
  ihtemam: Users,
  teacher_staff: GraduationCap,
  admission: Folder,
  students: Users,
  fee: Receipt,
  attendance: CalendarCheck,
  accounts: Wallet,
  talimat: BookOpen,
  communication: MessageSquare,
  users: Users,
  report: ClipboardList,
  reports: ClipboardList,
  website: Settings,
  website_settings: Settings,
  settings: Settings,
  library: Library,
};

// Kalpurush has one weight; a light stroke gives menu labels a semibold appearance.
const SEMIBOLD = "font-normal [-webkit-text-stroke:0.35px_currentColor]";
function navItemClass(isActive: boolean) {
  return `admin-nav-item flex items-center gap-2.5 rounded-xl px-3 py-2 text-base ${SEMIBOLD} transition-colors ${isActive ? "admin-nav-active" : "text-slate-600 hover:bg-teal-50 hover:text-teal-800 dark:text-slate-300 dark:hover:bg-teal-950/50 dark:hover:text-teal-200"}`;
}
function childItemClass(isActive: boolean) {
  return `admin-nav-child flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-base transition-colors ${
    isActive
      ? `admin-nav-child-active ${SEMIBOLD}`
      : "text-slate-600 hover:bg-teal-50 hover:text-teal-800 dark:text-slate-400 dark:hover:bg-teal-950/50 dark:hover:text-teal-200"
  }`;
}
function moduleHeaderClass(isActive: boolean) {
  return `admin-nav-item flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-base ${SEMIBOLD} transition-colors ${isActive ? "admin-nav-active" : "text-slate-700 hover:bg-teal-50 hover:text-teal-800 dark:text-slate-300 dark:hover:bg-teal-950/50 dark:hover:text-teal-200"}`;
}
export default function Sidebar({ closeSidebar }: SidebarProps) {
  // এই ইউজারের রোলে যে মডিউল/আইটেমের অনুমতি নেই, সেগুলো ধূসর করে দেখানোর
  // বদলে সম্পূর্ণ বাদ দেওয়া হয় - অনুমতি না থাকা জিনিস মেনুতেই দেখাবে না।
  const sidebarItems = useSidebarStore((s) => s.items);
  const sidebarLoaded = useSidebarStore((s) => s.loaded);
  // `.filter()` on every render would create a new array reference even when
  // `sidebarItems` itself hasn't changed, which would retrigger the
  // active-module sync effect below on every unrelated re-render (toast,
  // count polling, etc.) - not just on real navigation - forcing whichever
  // accordion you just opened by hand back to the current route's module.
  const sidebar = useMemo(() => sidebarItems.filter((m) => !m.disabled), [sidebarItems]);
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const branding = useBrandingStore((s) => s.branding);
  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => setLogoFailed(false), [branding?.report_logo]);
  const logout = useAuthStore((s) => s.logout);
  const location = useLocation();
  const t = useText(sidebarText);
  const c = useText(commonText);
  const collapsed = closeSidebar ? false : sidebarCollapsed;
  const handleClick = () => {
    if (closeSidebar) closeSidebar();
  };

  // Which module (with a submenu) the current route belongs to - used both
  // to auto-expand its accordion and to highlight its header, independent of
  // the open/closed accordion state so it stays visible even collapsed.
  // The matched child is also the only one highlighted - NavLink's own
  // prefix matching would light up "/students" on every /students/* page.
  const { activeModuleKey, activeChildKey } = useMemo(() => {
    const prefix = `/`;
    if (!location.pathname.startsWith(prefix)) return { activeModuleKey: null, activeChildKey: null };
    const subpath = location.pathname.slice(prefix.length).replace(/\/+$/, "");
    const match = matchSidebarPath(sidebar, subpath);
    return match?.child
      ? { activeModuleKey: match.module.key, activeChildKey: match.child.key }
      : { activeModuleKey: null, activeChildKey: null };
  }, [location.pathname, sidebar]);

  // Accordion: only one module's submenu open at a time, click its header to
  // toggle. Whichever module the current route belongs to is auto-expanded
  // so refreshing/deep-linking into a page never hides its own submenu.
  const [openModuleKey, setOpenModuleKey] = useState<string | null>(null);
  useEffect(() => {
    if (activeModuleKey) setOpenModuleKey(activeModuleKey);
  }, [activeModuleKey]);
  const toggleModule = (key: string) => {
    setOpenModuleKey((prev) => (prev === key ? null : key));
  };

  const handleLogout = async () => {
    // সার্ভার-সাইড রিভোক শেষ না হতেই রিডাইরেক্ট হলে রিকোয়েস্টটা রেসে হারিয়ে
    // যায় - প্রোফাইলের সেশন লিস্টে পুরনো "active" ডিভাইস রয়ে যায়।
    await logoutSession();
    logout();
  };

  const header = (
    <div className="admin-shell-header shrink-0 border-b border-t-2 border-teal-200 border-t-teal-600 bg-white dark:border-teal-900 dark:border-t-teal-400 dark:bg-slate-900">
      <div className={`flex h-full items-center ${collapsed ? "flex-col justify-center gap-1 p-2" : "gap-2 p-3"}`}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {branding?.report_logo && !logoFailed ? (
            <img
              src={branding.report_logo}
              alt=""
              onError={() => setLogoFailed(true)}
              className={`${collapsed ? "h-10 w-10" : "h-12 w-12"} shrink-0 rounded-full border border-teal-200 bg-white object-cover p-0.5 dark:border-teal-900`}
            />
          ) : (
            <span className={`flex ${collapsed ? "h-10 w-10" : "h-12 w-12"} shrink-0 items-center justify-center rounded-full border border-teal-200 text-teal-700 dark:border-teal-900 dark:text-teal-300`}>
              <GraduationCap size={collapsed ? 22 : 28} aria-hidden="true" />
            </span>
          )}
          {!collapsed && (
            <span className="whitespace-nowrap text-2xl font-bold leading-snug text-teal-700 dark:text-teal-300">
              Admin Panel
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {closeSidebar && (
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-red-200 bg-white text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:border-red-900 dark:bg-slate-900 dark:text-red-400 dark:hover:border-red-800 dark:hover:bg-red-950/40 dark:hover:text-red-300 md:hidden"
              onClick={closeSidebar}
              aria-label={t.closeMenu}
            >
              <X size={17} strokeWidth={1.75} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={toggleSidebar}
            title={collapsed ? t.expandMenu : t.collapseMenu}
            aria-label={collapsed ? t.expandMenu : t.collapseMenu}
            className="hidden h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200 md:flex"
          >
            {collapsed ? <PanelLeftOpen size={16} className="rtl:-scale-x-100" /> : <PanelLeftClose size={16} className="rtl:-scale-x-100" />}
          </button>
        </div>
      </div>
    </div>
  );

  // মোবাইল ড্রয়ারের একদম নিচে - প্ল্যান/থিম/লক + সরাসরি লগআউট (প্রোফাইল কার্ড
  // ছাড়াই, ক্লিক করলেই সরাসরি লগআউট হয়ে যায়)
  const footer = closeSidebar && (
    <div className="space-y-2 border-t border-slate-100 px-2 py-2.5 dark:border-slate-800 md:hidden">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <PlanBadge />
        <LanguageSwitcher dropUp />
      </div>
      <div className="flex items-center justify-center gap-2">
        <ThemeToggle className="shrink-0 !rounded-full !border-teal-200 hover:!border-teal-400 dark:!border-teal-800 dark:hover:!border-teal-600" />
        <LockButton className="!h-9 !w-9 !border-teal-200 hover:!border-teal-400 dark:!border-teal-800 dark:hover:!border-teal-600" />
        <button
          type="button"
          onClick={handleLogout}
          aria-label={c.logout}
          title={c.logout}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red-200 text-red-600 transition hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );

  if (!sidebarLoaded) {
    return (
      <AdminSidebarShell className="admin-sidebar" collapsed={collapsed} expandedWidth="w-64" header={header} footer={footer}>
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2">
              <Skeleton className="h-[18px] w-[18px] shrink-0 rounded-md" />
              {!collapsed && <Skeleton className="h-4 flex-1" />}
            </div>
          ))}
        </div>
      </AdminSidebarShell>
    );
  }

  return (
    <AdminSidebarShell className="admin-sidebar" collapsed={collapsed} expandedWidth="w-64" header={header} footer={footer}>
      {sidebar.map((module) => {
          const Icon = ICONS[module.key] || Folder;
          const visibleChildren = module.children?.filter((c) => !c.disabled) || [];

          if (!module.children || module.children.length === 0) {
            return (
              <NavLink
                key={module.key}
                to={`/${modulePath(module.key)}`}
                onClick={handleClick}
                onMouseEnter={() => prefetchAdminRoute(modulePath(module.key))}
                onFocus={() => prefetchAdminRoute(modulePath(module.key))}
                className={({ isActive }) => navItemClass(isActive)}
              >
                <Icon size={18} />
                {!collapsed && <span>{sidebarModuleLabel(t, module.key, module.label)}</span>}
              </NavLink>
            );
          }

          if (visibleChildren.length === 0) return null;

          const isOpen = !collapsed && openModuleKey === module.key;
          const isActiveModule = activeModuleKey === module.key;

          return (
            <div key={module.key}>
              <button
                type="button"
                onClick={() => toggleModule(module.key)}
                aria-expanded={isOpen}
                title={collapsed ? sidebarModuleLabel(t, module.key, module.label) : undefined}
                className={moduleHeaderClass(isActiveModule)}
              >
                <Icon size={18} />
                {!collapsed && <span className="flex-1 text-start">{sidebarModuleLabel(t, module.key, module.label)}</span>}
                {!collapsed && (
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-200 ${isActiveModule ? "text-teal-600 dark:text-teal-300" : "text-slate-400 dark:text-slate-500"} ${isOpen ? "rotate-180" : ""}`}
                  />
                )}
              </button>
              <div
                className={`grid transition-all duration-200 ease-in-out ${
                  isOpen ? "mt-2 mb-1 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="ms-5 space-y-1 overflow-hidden border-s border-teal-100 ps-3 dark:border-teal-900">
                  {visibleChildren.map((child) => (
                    <NavLink
                      key={child.key}
                      aria-current={isActiveModule && activeChildKey === child.key ? "page" : undefined}
                      to={`/${childPath(module.key, child.key)}`}
                      onClick={handleClick}
                      onMouseEnter={() => prefetchAdminRoute(childPath(module.key, child.key))}
                      onFocus={() => prefetchAdminRoute(childPath(module.key, child.key))}
                      className={() => childItemClass(isActiveModule && activeChildKey === child.key)}
                    >
                      <span className="min-w-0 flex-1 truncate whitespace-nowrap" title={sidebarChildLabel(t, module.key, child.key, child.label)}>{sidebarChildLabel(t, module.key, child.key, child.label)}</span>
                      {Boolean(child.count) && (
                        <span aria-live="polite" aria-atomic="true" className="inline-flex h-5 min-w-6 shrink-0 items-center justify-center rounded-md bg-amber-50 px-1.5 font-sans text-[11px] font-semibold tabular-nums text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-800">
                          {child.count}
                        </span>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
    </AdminSidebarShell>
  );
}
