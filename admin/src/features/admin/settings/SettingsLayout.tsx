import { useAdminDomainStore } from "../../../store/adminDomainStore";
import ResponsiveSettingsMenu from "../../../components/settings/ResponsiveSettingsMenu";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Settings2,
  UserCog,
  Paintbrush,
  FileText,
  CreditCard,
  Users,
  ShieldCheck,
  Package,
  Trash2,
  Info,
  Download,
} from "lucide-react";
import { prefetchAdminRoute } from "../../../app/routePrefetch";
import { useAuthStore } from "../../../store/authStore";
import { hasPermission } from "../../../utils/permissions";
import { useText } from "@madrasha/shared-ui/src/i18n";
import { sidebarText } from "../../../components/sidebar/sidebar.text";

// Same module/permission gates as this menu's own routes in router.tsx -
// keeps a tab from showing here only to redirect away the moment it's
// clicked (mirrors how the left sidebar already hides items the role can't
// reach, via its own `disabled` flag from sidebar.service.ts).
const SETTINGS_NAV_ITEMS: {
  key: string;
  label: "profileSettings" | "branding" | "reportDesign" | "paymentMethods" | "staffManagement" | "rolesPermissions" | "plan" | "trash" | "about" | "appInstaller";
  icon: typeof Settings2;
  module?: string;
  permission?: string;
  // Absolute override for entries that don't live under /settings/*.
  path?: string;
}[] = [
  { key: "branding", label: "branding", icon: Paintbrush, module: "settings", permission: "settings.manage" },
  { key: "app-install", label: "appInstaller", icon: Download },
  { key: "report-design", label: "reportDesign", icon: FileText, module: "settings", permission: "settings.manage" },
  { key: "profile", label: "profileSettings", icon: UserCog },
  { key: "payment-methods", label: "paymentMethods", icon: CreditCard, module: "settings" },
  { key: "users", label: "staffManagement", icon: Users, module: "settings", permission: "users.read" },
  { key: "roles", label: "rolesPermissions", icon: ShieldCheck, module: "settings", permission: "roles.manage" },
  { key: "plan", label: "plan", icon: Package },
  { key: "trash", label: "trash", icon: Trash2, module: "settings" },
  { key: "about", label: "about", icon: Info },
];

export default function SettingsLayout() {
  const { pathname } = useLocation();
  const institution = useAdminDomainStore((s) => s.institution);
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const modules = useAuthStore((s) => s.modules);
  const t = useText(sidebarText);

  const visibleItems = SETTINGS_NAV_ITEMS.filter((item) => {
    if (institution && item.key === "about") return false;
    if (item.module && !modules.includes(item.module)) return false;
    if (item.permission && !hasPermission(user, permissions, item.permission)) return false;
    return true;
  });

  const activeItem = visibleItems.find((item) => {
    const path = item.path ?? `/settings/${item.key}`;
    return pathname === path || pathname.startsWith(`${path}/`);
  });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-24">
      <ResponsiveSettingsMenu
        title={t.settingsMenu}
        activeLabel={activeItem ? t[activeItem.label] : t.settingsMenu}
        activeIcon={activeItem?.icon}
      >
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const to = item.path ?? `/settings/${item.key}`;
            return (
              <NavLink
                key={item.key}
                to={to}
                onMouseEnter={() => prefetchAdminRoute(item.path ? item.key : `settings/${item.key}`)}
                onFocus={() => prefetchAdminRoute(item.path ? item.key : `settings/${item.key}`)}
                className={({ isActive }) =>
                  `flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-start text-sm transition ${
                    isActive
                      ? "border-blue-700 bg-blue-50 text-blue-900 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300"
                      : "border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="flex min-w-0 items-center gap-2 truncate font-medium">
                      <Icon size={15} className="shrink-0" />
                      <span className="truncate">{t[item.label]}</span>
                    </span>
                    <span className={`inline-block rtl:-scale-x-100 ${isActive ? "text-blue-700 dark:text-blue-400" : "text-slate-300 dark:text-slate-600"}`}>
                      ›
                    </span>
                  </>
                )}
              </NavLink>
            );
          })}
      </ResponsiveSettingsMenu>

      <div className="min-w-0 max-w-4xl space-y-6">
        <Outlet />
      </div>
    </div>
  );
}
