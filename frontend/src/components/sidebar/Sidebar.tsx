import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useParams } from "react-router-dom";
import { useSidebarStore } from "../../store/sidebarStore";
import { useUIStore } from "../../store/uiStore";
import { useAuthStore } from "../../store/authStore";
import { logoutSession } from "../../services/profileApi";
import { getTenantAdminBase } from "../../utils/tenantSlug";
import { prefetchAdminRoute } from "../../app/routePrefetch";
import AdminSidebarShell from "../shell/AdminSidebarShell";
import { modulePath, childPath, matchSidebarPath } from "./sidebarPaths";

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
  UserCog,
  LogOut,
  MessageSquare,
  Library,
  CalendarCheck,
  GraduationCap,
  Receipt,
  UserRound,
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
  activity: ClipboardList,
  library: Library,
};

function navItemClass(isActive: boolean) {
  return `flex items-center gap-2 rounded-lg border-l-2 px-3 py-2 text-base font-medium transition ${isActive ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-300" : "border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"}`;
}
function childItemClass(isActive: boolean) {
  return `flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[15px] transition ${
    isActive
      ? "bg-indigo-100 font-semibold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
  }`;
}
function moduleHeaderClass(isActive: boolean) {
  return `flex w-full items-center gap-2 rounded-lg px-3 py-2 text-base font-semibold transition ${isActive ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300" : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`;
}
export default function Sidebar({ closeSidebar }: SidebarProps) {
  // এই ইউজারের রোলে যে মডিউল/আইটেমের অনুমতি নেই, সেগুলো ধূসর করে দেখানোর
  // বদলে সম্পূর্ণ বাদ দেওয়া হয় - অনুমতি না থাকা জিনিস মেনুতেই দেখাবে না।
  const sidebarItems = useSidebarStore((s) => s.items);
  // `.filter()` on every render would create a new array reference even when
  // `sidebarItems` itself hasn't changed, which would retrigger the
  // active-module sync effect below on every unrelated re-render (toast,
  // count polling, etc.) - not just on real navigation - forcing whichever
  // accordion you just opened by hand back to the current route's module.
  const sidebar = useMemo(() => sidebarItems.filter((m) => !m.disabled), [sidebarItems]);
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { madrasaSlug = "" } = useParams();
  const location = useLocation();
  const adminBase = getTenantAdminBase(madrasaSlug);
  const collapsed = closeSidebar ? false : sidebarCollapsed;
  const handleClick = () => {
    if (closeSidebar) closeSidebar();
  };

  // Which module (with a submenu) the current route belongs to - used both
  // to auto-expand its accordion and to highlight its header, independent of
  // the open/closed accordion state so it stays visible even collapsed.
  const activeModuleKey = useMemo(() => {
    const prefix = `${adminBase}/`;
    if (!location.pathname.startsWith(prefix)) return null;
    const subpath = location.pathname.slice(prefix.length).replace(/\/+$/, "");
    const match = matchSidebarPath(sidebar, subpath);
    return match?.child ? match.module.key : null;
  }, [location.pathname, sidebar, adminBase]);

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

  // Account dropdown - click the avatar card to reveal প্রোফাইল সেটিংস/লগআউট
  // instead of the card itself being a direct link (a single, unlabeled
  // click straight into a settings page reads as accidental, not a
  // deliberate action).
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const header = (
    <div className={`flex items-center gap-1 border-b border-slate-100 p-2 dark:border-slate-800 ${collapsed ? "justify-center" : ""}`}>
        {!collapsed && (
          <div ref={accountMenuRef} className="relative min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setAccountMenuOpen((v) => !v)}
              title="অ্যাকাউন্ট মেনু"
              className={`flex w-full items-center gap-2 rounded-lg p-1 transition hover:bg-slate-100 dark:hover:bg-slate-800 ${accountMenuOpen ? "bg-slate-100 dark:bg-slate-800" : ""}`}
            >
              {user?.photo_url ? (
                <img
                  src={user.photo_url}
                  alt={user.name}
                  className="h-9 w-9 shrink-0 rounded-full border border-slate-200 object-cover dark:border-slate-700"
                />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                  <UserRound size={20} />
                </span>
              )}
              <span className="min-w-0 flex-1 text-left leading-tight">
                <span className="block break-words text-base font-semibold text-slate-800 dark:text-slate-100">
                  {user?.name || "Madrasa"}
                </span>
                <span className="block break-words text-xs text-slate-800 dark:text-slate-100">
                  {user?.role_label || user?.role || ""}
                </span>
              </span>
            </button>

            {accountMenuOpen && (
              <div className="absolute left-0 top-full z-10 mt-1 w-56 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                <NavLink
                  to={`${adminBase}/settings/profile`}
                  onClick={() => {
                    setAccountMenuOpen(false);
                    handleClick();
                  }}
                  className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <UserCog size={16} className="text-slate-400 dark:text-slate-500" />
                  প্রোফাইল সেটিংস
                </NavLink>
                <button
                  type="button"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    logoutSession();
                    logout();
                  }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-rose-500 transition hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <LogOut size={16} />
                  লগআউট
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex shrink-0 items-center gap-1">
          {closeSidebar && (
            <button
              className="flex h-7 w-7 items-center justify-center rounded-lg text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200 md:hidden"
              onClick={closeSidebar}
            >
              ✕
            </button>
          )}
          <button
            type="button"
            onClick={toggleSidebar}
            title={collapsed ? "মেনু বড় করুন" : "মেনু ছোট করুন"}
            className="hidden h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200 md:flex"
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
      </div>
  );

  return (
    <AdminSidebarShell collapsed={collapsed} header={header}>
      {sidebar.map((module) => {
          const Icon = ICONS[module.key] || Folder;
          const visibleChildren = module.children?.filter((c) => !c.disabled) || [];

          if (!module.children || module.children.length === 0) {
            return (
              <NavLink
                key={module.key}
                to={`${adminBase}/${modulePath(module.key)}`}
                onClick={handleClick}
                onMouseEnter={() => prefetchAdminRoute(modulePath(module.key))}
                onFocus={() => prefetchAdminRoute(modulePath(module.key))}
                className={({ isActive }) => navItemClass(isActive)}
              >
                <Icon size={18} />
                {!collapsed && <span>{module.label}</span>}
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
                className={moduleHeaderClass(isActiveModule)}
              >
                <Icon size={18} />
                {!collapsed && <span className="flex-1 text-left">{module.label}</span>}
                {!collapsed && (
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-200 ${isActiveModule ? "text-indigo-400 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"} ${isOpen ? "rotate-180" : ""}`}
                  />
                )}
              </button>
              <div
                className={`grid transition-all duration-200 ease-in-out ${
                  isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="ml-6 space-y-1 overflow-hidden border-l border-slate-200 pl-3 dark:border-slate-700">
                  {visibleChildren.map((child) => (
                    <NavLink
                      key={child.key}
                      to={`${adminBase}/${childPath(module.key, child.key)}`}
                      onClick={handleClick}
                      onMouseEnter={() => prefetchAdminRoute(childPath(module.key, child.key))}
                      onFocus={() => prefetchAdminRoute(childPath(module.key, child.key))}
                      className={({ isActive }) => childItemClass(isActive)}
                    >
                      <span>{child.label}</span>
                      {Boolean(child.count) && (
                        <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white">
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
