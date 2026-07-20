import { NavLink, useParams } from "react-router-dom";
import { useSidebarStore } from "../../store/sidebarStore";
import { useUIStore } from "../../store/uiStore";
import Button from "../ui/Button";
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
  website: "website-settings",
  website_settings: "website-settings",
};
const FEATURE_PATHS: Record<string, string> = {
  acadamic_report: "academic-report",
  academic_report: "academic-report",
  student_report: "student_report",
  exam_report: "exam_report",
  teacher_report: "teacher_report",
};
function modulePath(key: string) {
  return MODULE_PATHS[key] || key;
}
function childPath(moduleKey: string, childKey: string) {
  return `${modulePath(moduleKey)}/${FEATURE_PATHS[childKey] || childKey}`;
}
function navItemClass(isActive: boolean) {
  return `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"}`;
}
function childItemClass(isActive: boolean) {
  return `block py-1 text-sm transition ${isActive ? "font-semibold text-blue-600" : "text-gray-600 hover:text-gray-900"}`;
}
const disabledClass =
  "flex cursor-not-allowed items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-300";
const disabledChildClass = "block cursor-not-allowed py-1 text-sm text-slate-300";

export default function Sidebar({ closeSidebar }: SidebarProps) {
  const sidebar = useSidebarStore((s) => s.items);
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const { madrasaSlug = "" } = useParams();
  const adminBase = getTenantAdminBase(madrasaSlug);
  const collapsed = closeSidebar ? false : sidebarCollapsed;
  const handleClick = () => {
    if (closeSidebar) closeSidebar();
  };

  return (
    <div
      className={`flex h-screen flex-col border-r bg-white transition-all duration-300 ${collapsed ? "w-16" : "w-64"}`}
    >
      <div className="flex items-center justify-between border-b p-4">
        {!collapsed && <div className="text-lg font-bold text-blue-600">Madrasa</div>}
        <div className="flex items-center gap-2">
          {closeSidebar && (
            <button className="text-lg md:hidden" onClick={closeSidebar}>
              ✕
            </button>
          )}
          <Button variant="ghost" onClick={toggleSidebar} className="hidden md:block">
            {collapsed ? "»" : "«"}
          </Button>
        </div>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto p-2">
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

          return (
            <div key={module.key} className={moduleDisabled ? "opacity-70" : ""}>
              <div
                className={`flex items-center gap-2 px-3 py-2 font-semibold ${moduleDisabled ? "text-slate-300" : "text-gray-700"}`}
              >
                <Icon size={18} />
                {!collapsed && <span>{module.label}</span>}
                {moduleDisabled && !collapsed && <Lock size={13} className="ml-auto" />}
              </div>
              {!collapsed && (
                <div className="ml-6 space-y-1 border-l border-gray-200 pl-3">
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
                        className={({ isActive }) => childItemClass(isActive)}
                      >
                        {child.label}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
