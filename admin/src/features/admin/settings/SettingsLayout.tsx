import { NavLink, Outlet } from "react-router-dom";
import {
  Settings2,
  UserCog,
  Paintbrush,
  CreditCard,
  Users,
  ShieldCheck,
  Package,
  Trash2,
  Code2,
} from "lucide-react";
import { prefetchAdminRoute } from "../../../app/routePrefetch";
import { useAuthStore } from "../../../store/authStore";
import { hasPermission } from "../../../utils/permissions";

// Same module/permission gates as this menu's own routes in router.tsx -
// keeps a tab from showing here only to redirect away the moment it's
// clicked (mirrors how the left sidebar already hides items the role can't
// reach, via its own `disabled` flag from sidebar.service.ts).
const SETTINGS_NAV_ITEMS: {
  key: string;
  label: string;
  icon: typeof Settings2;
  module?: string;
  permission?: string;
  // Absolute override for entries that don't live under /settings/* (e.g. the
  // developer-info page, which is a shared top-level route reused elsewhere —
  // see HikmahItPage.tsx / VendorPromoCard.tsx).
  path?: string;
}[] = [
  { key: "profile", label: "প্রোফাইল সেটিংস", icon: UserCog },
  { key: "branding", label: "প্রতিষ্ঠান ব্র্যান্ডিং", icon: Paintbrush, module: "settings", permission: "settings.manage" },
  { key: "payment-methods", label: "পেমেন্ট পদ্ধতি", icon: CreditCard, module: "settings" },
  { key: "users", label: "স্টাফ ব্যবস্থাপনা", icon: Users, module: "settings", permission: "users.read" },
  { key: "roles", label: "রোল ও পারমিশন", icon: ShieldCheck, module: "settings", permission: "roles.manage" },
  { key: "plan", label: "প্ল্যান", icon: Package },
  { key: "trash", label: "ট্র্যাশ", icon: Trash2, module: "settings" },
  { key: "hikmah-it", label: "ডেভেলপার তথ্য", icon: Code2, path: "/hikmah-it" },
];

export default function SettingsLayout() {
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const modules = useAuthStore((s) => s.modules);

  const visibleItems = SETTINGS_NAV_ITEMS.filter((item) => {
    if (item.module && !modules.includes(item.module)) return false;
    if (item.permission && !hasPermission(user, permissions, item.permission)) return false;
    return true;
  });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-24">
      {/* ওয়েবসাইট সেটিংস পেজের নিজস্ব "সেটিংস মেনু" সাইডবারের মতো একই স্টাইল -
          UI ধারাবাহিকতা রাখতে (দেখুন AdminWebsiteSettingsPage.tsx)। */}
      <aside className="settings-sidebar no-print self-start rounded-2xl border border-gray-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:sticky lg:top-4">
        <div className="mb-2 rounded-lg bg-blue-800 px-3 py-2 text-white">
          <h2 className="text-base font-bold">সেটিংস মেনু</h2>
        </div>
        <div className="space-y-1">
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
                  `flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition ${
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
                      <span className="truncate">{item.label}</span>
                    </span>
                    <span className={isActive ? "text-blue-700 dark:text-blue-400" : "text-slate-300 dark:text-slate-600"}>
                      ›
                    </span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </aside>

      <div className="min-w-0 max-w-4xl space-y-6">
        <Outlet />
      </div>
    </div>
  );
}
