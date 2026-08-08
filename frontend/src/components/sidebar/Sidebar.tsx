import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useParams } from "react-router-dom";
import { useSidebarStore } from "../../store/sidebarStore";
import { useUIStore } from "../../store/uiStore";
import { useAuthStore } from "../../store/authStore";
import { getTenantAdminBase } from "../../utils/tenantSlug";
import { prefetchAdminRoute } from "../../app/routePrefetch";

import {
  LayoutDashboard,
  Folder,
  Wallet,
  BookOpen,
  Users,
  Settings,
  ClipboardList,
  Lock,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  UserCog,
  LogOut,
} from "lucide-react";

type SidebarProps = { closeSidebar?: () => void };

const ICONS: Record<string, any> = {
  dashboard: LayoutDashboard,
  ihtemam: Users,
  admission: Folder,
  students: Users,
  accounts: Wallet,
  talimat: BookOpen,
  users: Users,
  report: ClipboardList,
  reports: ClipboardList,
  website: Settings,
  website_settings: Settings,
  settings: Settings,
  activity: ClipboardList,
};

const MODULE_PATHS: Record<string, string> = {
  reports: "reports",
  report: "reports",
  website: "settings/website",
  website_settings: "settings/website",
};
const FEATURE_PATHS: Record<string, string> = {
  acadamic_report: "academic-report",
  academic_report: "academic-report",
  student_report: "student_report",
  exam_report: "exam_report",
  teacher_report: "teacher_report",
};
// Some sidebar entries (moved here from plain action buttons on the ছাত্র
// তালিকা page) live at routes that don't match their menu's own module path
// (e.g. "promotion" sits under তালিমাত but its route is still students/promotion)
// — these need the full path, not module/childKey.
const ABSOLUTE_CHILD_PATHS: Record<string, string> = {
  fee_management: "fee-management",
  notifications: "notifications",
  routine: "routine",
  promotion: "students/promotion",
  attendance_mark: "attendance/mark",
  payroll: "payroll",
};
function modulePath(key: string) {
  return MODULE_PATHS[key] || key;
}
function childPath(moduleKey: string, childKey: string) {
  if (ABSOLUTE_CHILD_PATHS[childKey]) return ABSOLUTE_CHILD_PATHS[childKey];
  return `${modulePath(moduleKey)}/${FEATURE_PATHS[childKey] || childKey}`;
}
function navItemClass(isActive: boolean) {
  return `flex items-center gap-2 rounded-lg border-l-2 px-3 py-2 text-base font-medium transition ${isActive ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`;
}
function childItemClass(isActive: boolean) {
  return `block py-1.5 text-[15px] transition ${isActive ? "font-semibold text-indigo-600" : "text-slate-500 hover:text-slate-900"}`;
}
const disabledClass =
  "flex cursor-not-allowed items-center gap-2 rounded-lg px-3 py-2 text-base font-medium text-slate-300";
const disabledChildClass = "block cursor-not-allowed py-1.5 text-[15px] text-slate-300";

export default function Sidebar({ closeSidebar }: SidebarProps) {
  const sidebar = useSidebarStore((s) => s.items);
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

  // Accordion: only one module's submenu open at a time, click its header to
  // toggle. Whichever module the current route belongs to is auto-expanded
  // so refreshing/deep-linking into a page never hides its own submenu.
  const [openModuleKey, setOpenModuleKey] = useState<string | null>(null);
  useEffect(() => {
    const active = sidebar.find(
      (m) =>
        m.children?.length && location.pathname.startsWith(`${adminBase}/${modulePath(m.key)}`),
    );
    if (active) setOpenModuleKey(active.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, sidebar]);
  const toggleModule = (key: string) => {
    setOpenModuleKey((prev) => (prev === key ? null : key));
  };

  const avatarLetter = (user?.name || "ম").trim().charAt(0).toUpperCase();

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

  return (
    <div
      className={`flex h-screen flex-col border-r border-slate-200 bg-white transition-all duration-300 ${collapsed ? "w-16" : "w-56"}`}
    >
      <div className={`flex items-center gap-1 border-b border-slate-100 p-2 ${collapsed ? "justify-center" : ""}`}>
        {!collapsed && (
          <div ref={accountMenuRef} className="relative min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setAccountMenuOpen((v) => !v)}
              title="অ্যাকাউন্ট মেনু"
              className={`flex w-full items-center gap-2 rounded-lg p-1 transition hover:bg-slate-100 ${accountMenuOpen ? "bg-slate-100" : ""}`}
            >
              {user?.photo_url ? (
                <img
                  src={user.photo_url}
                  alt={user.name}
                  className="h-9 w-9 shrink-0 rounded-full border border-slate-200 object-cover"
                />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white">
                  {avatarLetter}
                </span>
              )}
              <span className="min-w-0 flex-1 text-left leading-tight">
                <span className="block truncate text-sm font-semibold text-slate-800">
                  {user?.name || "Madrasa"}
                </span>
                <span className="block truncate text-xs text-slate-400">
                  {user?.mobile || user?.email || ""}
                </span>
              </span>
            </button>

            {accountMenuOpen && (
              <div className="absolute left-0 top-full z-10 mt-1 w-56 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg">
                <NavLink
                  to={`${adminBase}/settings/profile`}
                  onClick={() => {
                    setAccountMenuOpen(false);
                    handleClick();
                  }}
                  className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                >
                  <UserCog size={16} className="text-slate-400" />
                  প্রোফাইল সেটিংস
                </NavLink>
                <button
                  type="button"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    logout();
                  }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-rose-500 transition hover:bg-rose-50"
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
              className="flex h-7 w-7 items-center justify-center rounded-lg text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 md:hidden"
              onClick={closeSidebar}
            >
              ✕
            </button>
          )}
          <button
            type="button"
            onClick={toggleSidebar}
            title={collapsed ? "মেনু বড় করুন" : "মেনু ছোট করুন"}
            className="hidden h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 md:flex"
          >
            {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        </div>
      </div>

      <nav className="app-sidebar-nav flex-1 space-y-2 overflow-y-auto p-2">
        {sidebar.map((module) => {
          const Icon = ICONS[module.key] || Folder;
          const moduleDisabled = Boolean(module.disabled);

          if (!module.children || module.children.length === 0) {
            if (moduleDisabled) {
              return (
                <div key={module.key} className={disabledClass} title="এই ইউজারের অনুমতি নেই">
                  <Icon size={18} />
                  {!collapsed && (
                    <>
                      <span>{module.label}</span>
                      <Lock size={13} className="ml-auto" />
                    </>
                  )}
                </div>
              );
            }
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

          const isOpen = !collapsed && openModuleKey === module.key;

          return (
            <div key={module.key} className={moduleDisabled ? "opacity-70" : ""}>
              <button
                type="button"
                onClick={() => toggleModule(module.key)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-base font-semibold transition ${
                  moduleDisabled ? "text-slate-300" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <Icon size={18} />
                {!collapsed && <span className="flex-1 text-left">{module.label}</span>}
                {moduleDisabled && !collapsed && <Lock size={13} />}
                {!collapsed && !moduleDisabled && (
                  <ChevronDown
                    size={16}
                    className={`text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  />
                )}
              </button>
              <div
                className={`grid transition-all duration-200 ease-in-out ${
                  isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="ml-6 space-y-1 overflow-hidden border-l border-slate-200 pl-3">
                  {module.children.map((child) => {
                    const childDisabled = moduleDisabled || Boolean(child.disabled);
                    return childDisabled ? (
                      <span key={child.key} className={disabledChildClass}>
                        {child.label}
                      </span>
                    ) : (
                      <NavLink
                        key={child.key}
                        to={`${adminBase}/${childPath(module.key, child.key)}`}
                        onClick={handleClick}
                        onMouseEnter={() => prefetchAdminRoute(childPath(module.key, child.key))}
                        onFocus={() => prefetchAdminRoute(childPath(module.key, child.key))}
                        className={({ isActive }) =>
                          `flex items-center justify-between gap-2 pr-2 ${childItemClass(isActive)}`
                        }
                      >
                        <span>{child.label}</span>
                        {Boolean(child.count) && (
                          <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white">
                            {child.count}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </nav>
    </div>
  );
}
