import { prefetchSuperAdminRoute } from "../../app/routePrefetch";
import "./super-admin-sidebar.css";
import { ReactElement, useEffect, useId, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import AdminSidebarShell from "@madrasha/shared-ui/src/components/shell/AdminSidebarShell";
import { useText } from "@madrasha/shared-ui/src/i18n";
import { shellText, type NavGroupKey, type NavLabelKey } from "./shell.text";
import {
  LayoutDashboard, School, Trash2, CreditCard, Globe2, FileStack,
  Settings, Layers, Wallet, PanelLeftClose, PanelLeftOpen,
  Send, Mail, ClipboardList, Tags, BarChart3, Link2, Megaphone,
  ChevronDown, ShieldCheck, X,
} from "lucide-react";

type SuperAdminSidebarProps = {
  collapsed: boolean;
  onToggleCollapse: () => void;
  closeSidebar?: () => void;
};

type NavItem = {
  to: string;
  label: NavLabelKey;
  icon: ReactElement;
  end?: boolean;
  group: NavGroupKey;
};

// Keep a flat export for breadcrumbs, ordered by the sidebar's sections.
export const SUPER_ADMIN_NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "dashboard", icon: <LayoutDashboard size={18} />, end: true, group: "main" },
  { to: "/activity", label: "activity", icon: <ClipboardList size={18} />, group: "activity" },
  { to: "/madrasas", label: "institutions", icon: <School size={18} />, end: true, group: "institutions" },
  { to: "/leads", label: "leads", icon: <Megaphone size={18} />, group: "institutions" },
  { to: "/madrasas/trash", label: "trash", icon: <Trash2 size={18} />, group: "institutions" },
  { to: "/plans", label: "plans", icon: <CreditCard size={18} />, group: "billing" },
  { to: "/billing/requests", label: "billingRequests", icon: <ClipboardList size={18} />, group: "billing" },
  { to: "/billing/sms-packages", label: "smsPackages", icon: <Send size={18} />, group: "billing" },
  { to: "/billing/email-packages", label: "emailPackages", icon: <Mail size={18} />, group: "billing" },
  { to: "/billing/pricing", label: "billingPricing", icon: <Tags size={18} />, group: "billing" },
  { to: "/billing/reports", label: "billingReports", icon: <BarChart3 size={18} />, group: "billing" },
  { to: "/catalog", label: "catalog", icon: <Layers size={18} />, group: "content" },
  { to: "/document-templates", label: "documentTemplates", icon: <FileStack size={18} />, group: "content" },
  { to: "/fee-structure-templates", label: "feeTemplates", icon: <Wallet size={18} />, group: "content" },
  { to: "/websites", label: "websites", icon: <Globe2 size={18} />, group: "websites" },
  { to: "/important-links", label: "importantLinks", icon: <Link2 size={18} />, group: "websites" },
  { to: "/vendor-promo", label: "vendorPromo", icon: <Megaphone size={18} />, group: "websites" },
  { to: "/settings", label: "settings", icon: <Settings size={18} />, group: "settings" },
];

function groupNavItems(items: NavItem[]) {
  const groups = new Map<NavGroupKey, NavItem[]>();
  for (const item of items) {
    const list = groups.get(item.group);
    if (list) list.push(item);
    else groups.set(item.group, [item]);
  }
  return Array.from(groups.entries());
}

const GROUP_ICONS: Partial<Record<NavGroupKey, ReactElement>> = {
  institutions: <School size={18} />,
  billing: <Wallet size={18} />,
  content: <Layers size={18} />,
  websites: <Globe2 size={18} />,
};

const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900";

function navItemClass(isActive: boolean, collapsed: boolean, child = false) {
  return `sa-menu-link ${isActive ? "sa-menu-link-active" : ""} group flex min-h-11 items-center rounded-xl text-sm transition-colors ${focusClass} ${
    collapsed ? "justify-center px-2" : "gap-3 px-3"
  } ${child ? "min-h-10" : "font-medium"} ${
    isActive
      ? "bg-indigo-50 font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/20"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
  }`;
}

export default function SuperAdminSidebar({ collapsed, onToggleCollapse, closeSidebar }: SuperAdminSidebarProps) {
  const t = useText(shellText);
  const location = useLocation();
  const submenuId = useId();
  const groups = useMemo(() => groupNavItems(SUPER_ADMIN_NAV_ITEMS), []);
  const activeGroup = useMemo(() => {
    // Match complete path segments, including nested detail/editor routes.
    const match = [...SUPER_ADMIN_NAV_ITEMS]
      .sort((a, b) => b.to.length - a.to.length)
      .find((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));
    return match?.group ?? null;
  }, [location.pathname]);
  const [openGroup, setOpenGroup] = useState<NavGroupKey | null>(activeGroup);
  useEffect(() => {
    setOpenGroup(activeGroup);
  }, [activeGroup, location.pathname]);


  const renderLink = (item: NavItem, child = false) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      onMouseEnter={() => prefetchSuperAdminRoute(item.to)}
      onFocus={() => prefetchSuperAdminRoute(item.to)}
      onClick={() => closeSidebar?.()}
      title={collapsed ? t.nav[item.label] : undefined}
      aria-label={collapsed ? t.nav[item.label] : undefined}
      className={({ isActive }) => navItemClass(isActive, collapsed, child)}
    >
      <span aria-hidden="true" className="sa-menu-icon shrink-0">{item.icon}</span>
      {!collapsed && <span className="min-w-0 flex-1 leading-6">{t.nav[item.label]}</span>}
    </NavLink>
  );

  const header = (
    <div className={`sa-menu-header flex min-h-20 shrink-0 items-center border-b border-slate-100 dark:border-slate-800 ${collapsed ? "flex-col gap-2 px-2 py-3" : "gap-3 px-4 py-5"}`}>
      <div aria-hidden="true" className="sa-menu-brand flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
        <ShieldCheck size={22} />
      </div>
      {!collapsed && (
        <div className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-white">{t.superAdmin}</span>
          <span className="mt-1 block text-xs leading-5 text-slate-300">{t.controlPanel}</span>
        </div>
      )}
      {closeSidebar && (
        <button type="button" aria-label={t.closeMenu} onClick={closeSidebar} className={`rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden ${focusClass}`}>
          <X size={18} />
        </button>
      )}
      <button
        type="button"
        onClick={onToggleCollapse}
        title={collapsed ? t.expandMenu : t.collapseMenu}
        aria-label={collapsed ? t.expandMenu : t.collapseMenu}
        className={`hidden shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 md:flex ${focusClass}`}
      >
        {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </button>
    </div>
  );


  return (
    <AdminSidebarShell className={`sa-sidebar ${collapsed ? "sa-sidebar-collapsed" : ""}`} collapsed={collapsed} expandedWidth="w-64" header={header}>
      {!collapsed && <p className="px-3 pb-1 pt-3 text-xs font-semibold tracking-wide text-slate-400 dark:text-slate-500">{t.navigation}</p>}
      {groups.map(([group, items], index) => {
        const isOpen = !collapsed && openGroup === group;
        const isActive = activeGroup === group;
        return (
          <div key={group} data-menu-group={group} className={index > 0 ? "border-t border-slate-100 pt-2 dark:border-slate-800" : ""}>
            {collapsed || items.length === 1 ? (
              <div className="space-y-1">{items.map((item) => renderLink(item))}</div>
            ) : (
              <>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`${submenuId}-${group}`}
                  onClick={() => setOpenGroup((prev) => prev === group ? null : group)}
                  className={`sa-menu-group flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors ${focusClass} ${isActive ? "text-indigo-700 dark:text-indigo-300" : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
                >
                  <span aria-hidden="true" className="sa-menu-icon shrink-0">{GROUP_ICONS[group]}</span>
                  <span className="flex-1 text-start leading-6">{t.groups[group]}</span>
                  <ChevronDown size={14} aria-hidden="true" className={`shrink-0 text-slate-400 transition-transform motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`} />
                </button>
                <div id={`${submenuId}-${group}`} hidden={!isOpen}>
                  <div className="mb-2 ms-5 mt-1 space-y-1 border-s border-slate-200 ps-2 dark:border-slate-700">
                    {items.map((item) => renderLink(item, true))}
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })}
    </AdminSidebarShell>
  );
}
