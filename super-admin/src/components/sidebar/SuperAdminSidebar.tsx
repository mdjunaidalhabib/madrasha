import { ReactElement, useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import AdminSidebarShell from "@madrasha/shared-ui/src/components/shell/AdminSidebarShell";
import { useAdminAuthStore } from "../../store/adminAuthStore";
import { commonText, useText } from "@madrasha/shared-ui/src/i18n";
import { shellText, type NavGroupKey, type NavLabelKey } from "./shell.text";
import {
  LayoutDashboard,
  School,
  Trash2,
  CreditCard,
  Globe2,
  FileStack,
  Settings,
  Layers,
  Wallet,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  Mail,
  ClipboardList,
  Tags,
  BarChart3,
  Link2,
  Megaphone,
  ChevronDown,
} from "lucide-react";

type SuperAdminSidebarProps = {
  collapsed: boolean;
  onToggleCollapse: () => void;
  closeSidebar?: () => void;
};

type NavItem = { to: string; label: NavLabelKey; icon: ReactElement; end?: boolean; group: NavGroupKey };

// পাঁচটি লজিক্যাল গ্রুপে সাজানো - সাইডবারে গ্রুপ-হেডিং দেখানোর জন্য প্রতিটি
// আইটেমে group ট্যাগ করা থাকে, নিচের রেন্ডারে সেই গ্রুপ অনুযায়ী ভাগ করে
// দেখানো হয়। ফ্ল্যাট অ্যারে-ই থাকছে (breadcrumb হুক এটাকে ফ্ল্যাট হিসেবে খোঁজে)।
export const SUPER_ADMIN_NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "dashboard", icon: <LayoutDashboard size={18} />, end: true, group: "main" },

  { to: "/madrasas", label: "institutions", icon: <School size={18} />, end: true, group: "institutions" },
  { to: "/madrasas/trash", label: "trash", icon: <Trash2 size={18} />, group: "institutions" },
  { to: "/plans", label: "plans", icon: <CreditCard size={18} />, group: "institutions" },

  { to: "/document-templates", label: "documentTemplates", icon: <FileStack size={18} />, group: "content" },
  { to: "/catalog", label: "catalog", icon: <Layers size={18} />, group: "content" },
  { to: "/fee-structure-templates", label: "feeTemplates", icon: <Wallet size={18} />, group: "content" },
  { to: "/important-links", label: "importantLinks", icon: <Link2 size={18} />, group: "content" },
  { to: "/vendor-promo", label: "vendorPromo", icon: <Megaphone size={18} />, group: "content" },
  { to: "/websites", label: "websites", icon: <Globe2 size={18} />, group: "content" },

  // বিলিং (SMS/Email credit বিক্রয়)
  { to: "/billing/sms-packages", label: "smsPackages", icon: <Send size={18} />, group: "billing" },
  { to: "/billing/email-packages", label: "emailPackages", icon: <Mail size={18} />, group: "billing" },
  { to: "/billing/requests", label: "billingRequests", icon: <ClipboardList size={18} />, group: "billing" },
  { to: "/billing/pricing", label: "billingPricing", icon: <Tags size={18} />, group: "billing" },
  { to: "/billing/reports", label: "billingReports", icon: <BarChart3 size={18} />, group: "billing" },

  { to: "/settings", label: "settings", icon: <Settings size={18} />, group: "settings" },
];

// রেন্ডারের সময় ব্যবহারের জন্য group অনুযায়ী ভাগ করা - Map ইনসার্শন-অর্ডার
// ধরে রাখে, তাই উপরের অ্যারের ক্রমই গ্রুপগুলোর ক্রম নির্ধারণ করে।
function groupNavItems(items: NavItem[]) {
  const groups = new Map<NavGroupKey, NavItem[]>();
  for (const item of items) {
    const list = groups.get(item.group);
    if (list) list.push(item);
    else groups.set(item.group, [item]);
  }
  return Array.from(groups.entries());
}

function navItemClass(isActive: boolean) {
  return `flex items-center gap-2 rounded-lg border-s-2 px-3 py-2 text-base font-medium transition ${
    isActive
      ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-300"
      : "border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
  }`;
}

function childItemClass(isActive: boolean) {
  return `flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[15px] transition ${
    isActive
      ? "bg-indigo-100 font-semibold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
  }`;
}

function groupHeaderClass(isActive: boolean) {
  return `flex w-full items-center gap-2 rounded-lg px-3 py-2 text-base font-semibold transition ${
    isActive
      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
      : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
  }`;
}

// গ্রুপের প্রথম আইটেমের আইকনটাই accordion হেডারের আইকন হিসেবে ব্যবহার করা হয় -
// প্রতিটা গ্রুপের জন্য আলাদা আইকন সংজ্ঞায়িত করার বদলে সহজ সমাধান।
const GROUP_ICONS: Partial<Record<NavGroupKey, ReactElement>> = {
  institutions: <School size={18} />,
  content: <Layers size={18} />,
  billing: <Wallet size={18} />,
};

export default function SuperAdminSidebar({
  collapsed,
  onToggleCollapse,
  closeSidebar,
}: SuperAdminSidebarProps) {
  const t = useText(shellText);
  const c = useText(commonText);
  const admin = useAdminAuthStore((s) => s.admin);
  const logout = useAdminAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();

  const groups = useMemo(() => groupNavItems(SUPER_ADMIN_NAV_ITEMS), []);

  // বর্তমান রুট যে গ্রুপে পড়ে, সেটা - একাধিক আইটেমের গ্রুপ (accordion) হলেই
  // প্রযোজ্য, "মূল"/"সেটিংস" এর মতো একক-আইটেম গ্রুপ কখনো accordion হয় না।
  const activeGroup = useMemo(() => {
    const match = groups.find(
      ([, items]) => items.length > 1 && items.some((item) => location.pathname.startsWith(item.to)),
    );
    return match?.[0] ?? null;
  }, [groups, location.pathname]);

  // একবারে একটাই গ্রুপ খোলা থাকে, হেডারে ক্লিক করলে টগল হয়। বর্তমান রুটের
  // গ্রুপ পাল্টালে স্বয়ংক্রিয়ভাবে সেটাই খুলে যায় - রিফ্রেশ/ডিপ-লিংকেও সাবমেনু
  // লুকিয়ে থাকে না।
  const [openGroup, setOpenGroup] = useState<NavGroupKey | null>(null);
  useEffect(() => {
    if (activeGroup) setOpenGroup(activeGroup);
  }, [activeGroup]);
  const toggleGroup = (group: NavGroupKey) => {
    setOpenGroup((prev) => (prev === group ? null : group));
  };

  const handleClick = () => {
    if (closeSidebar) closeSidebar();
  };

  const handleLogout = () => {
    handleClick();
    logout();
    navigate("/login", { replace: true });
  };

  const header = (
    <div
      className={`flex items-center gap-1 border-b border-slate-100 p-2 dark:border-slate-800 ${collapsed ? "justify-center" : ""}`}
    >
      {!collapsed && (
        <div className="min-w-0 flex-1">
          <span className="block break-words text-sm font-semibold text-slate-800 dark:text-slate-100">
            {t.superAdmin}
          </span>
          <span className="block break-words text-xs text-slate-400 dark:text-slate-500">
            {admin?.name || ""}
          </span>
        </div>
      )}
      <div className="flex shrink-0 items-center gap-1">
        {closeSidebar && (
          <button
            aria-label={t.closeMenu}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200 md:hidden"
            onClick={closeSidebar}
          >
            ✕
          </button>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          title={collapsed ? t.expandMenu : t.collapseMenu}
          className="hidden h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200 md:flex"
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>
    </div>
  );

  const footer = (
    <div className="border-t border-slate-100 p-2 dark:border-slate-800">
      <button
        type="button"
        onClick={handleLogout}
        title={c.logout}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-rose-500 transition hover:bg-rose-50 dark:hover:bg-rose-950/40"
      >
        <LogOut size={16} />
        {!collapsed && <span>{c.logout}</span>}
      </button>
    </div>
  );

  return (
    <AdminSidebarShell collapsed={collapsed} header={header} footer={footer}>
      {groups.map(([group, items], index) => {
        // একক-আইটেম গ্রুপ ("মূল", "সেটিংস") - সরাসরি লিংক, কোনো সাবমেনু নেই।
        if (items.length === 1) {
          const item = items[0];
          return (
            <div key={group} className={index > 0 ? "mt-4" : ""}>
              {collapsed && index > 0 && (
                <div className="mx-2 mb-2 border-t border-slate-100 dark:border-slate-800" />
              )}
              <NavLink
                to={item.to}
                end={item.end}
                onClick={handleClick}
                title={collapsed ? t.nav[item.label] : undefined}
                className={({ isActive }) => navItemClass(isActive)}
              >
                {item.icon}
                {!collapsed && <span>{t.nav[item.label]}</span>}
              </NavLink>
            </div>
          );
        }

        const isOpen = !collapsed && openGroup === group;
        const isActive = activeGroup === group;

        return (
          <div key={group} className={index > 0 ? "mt-4" : ""}>
            {collapsed && index > 0 && (
              <div className="mx-2 mb-2 border-t border-slate-100 dark:border-slate-800" />
            )}
            <button
              type="button"
              onClick={() => toggleGroup(group)}
              title={collapsed ? t.groups[group] : undefined}
              className={groupHeaderClass(isActive)}
            >
              {GROUP_ICONS[group] || <Layers size={18} />}
              {!collapsed && <span className="flex-1 text-start">{t.groups[group]}</span>}
              {!collapsed && (
                <ChevronDown
                  size={16}
                  className={`transition-transform duration-200 ${isActive ? "text-indigo-400 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"} ${isOpen ? "rotate-180" : ""}`}
                />
              )}
            </button>
            <div
              className={`grid transition-all duration-200 ease-in-out ${
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="ms-6 space-y-1 overflow-hidden border-s border-slate-200 ps-3 dark:border-slate-700">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={handleClick}
                    className={({ isActive: linkActive }) => childItemClass(linkActive)}
                  >
                    <span>{t.nav[item.label]}</span>
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
