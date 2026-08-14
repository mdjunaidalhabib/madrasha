import { ReactElement } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import AdminSidebarShell from "../shell/AdminSidebarShell";
import { useAdminAuthStore } from "../../store/adminAuthStore";
import {
  LayoutDashboard,
  School,
  Trash2,
  CreditCard,
  Globe2,
  ChevronsLeft,
  ChevronsRight,
  FileStack,
  Settings,
  Layers,
  Wallet,
  LogOut,
} from "lucide-react";

type SuperAdminSidebarProps = {
  collapsed: boolean;
  onToggleCollapse: () => void;
  closeSidebar?: () => void;
};

type NavItem = { to: string; label: string; icon: ReactElement; end?: boolean };

const NAV_ITEMS: NavItem[] = [
  { to: "/super-admin/dashboard", label: "ড্যাশবোর্ড", icon: <LayoutDashboard size={18} />, end: true },
  { to: "/super-admin/madrasas", label: "মাদরাসাসমূহ", icon: <School size={18} />, end: true },
  { to: "/super-admin/madrasas/trash", label: "ট্র্যাশ", icon: <Trash2 size={18} /> },
  { to: "/super-admin/plans", label: "প্ল্যানসমূহ", icon: <CreditCard size={18} /> },
  { to: "/super-admin/document-templates", label: "ডকুমেন্ট টেমপ্লেট", icon: <FileStack size={18} /> },
  { to: "/super-admin/catalog", label: "একাডেমিক ক্যাটালগ", icon: <Layers size={18} /> },
  { to: "/super-admin/fee-structure-templates", label: "ফি টেমপ্লেট", icon: <Wallet size={18} /> },
  { to: "/super-admin/websites", label: "ওয়েবসাইটসমূহ", icon: <Globe2 size={18} /> },
  { to: "/super-admin/settings", label: "সেটিংস", icon: <Settings size={18} /> },
];

function navItemClass(isActive: boolean) {
  return `flex items-center gap-2 rounded-lg border-l-2 px-3 py-2 text-base font-medium transition ${
    isActive
      ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-300"
      : "border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
  }`;
}

export default function SuperAdminSidebar({
  collapsed,
  onToggleCollapse,
  closeSidebar,
}: SuperAdminSidebarProps) {
  const admin = useAdminAuthStore((s) => s.admin);
  const logout = useAdminAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const handleClick = () => {
    if (closeSidebar) closeSidebar();
  };

  const handleLogout = () => {
    handleClick();
    logout();
    navigate("/super-admin/login", { replace: true });
  };

  const header = (
    <div
      className={`flex items-center gap-1 border-b border-slate-100 p-2 dark:border-slate-800 ${collapsed ? "justify-center" : ""}`}
    >
      {!collapsed && (
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            সুপার অ্যাডমিন
          </span>
          <span className="block truncate text-xs text-slate-400 dark:text-slate-500">
            {admin?.name || ""}
          </span>
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
          onClick={onToggleCollapse}
          title={collapsed ? "মেনু বড় করুন" : "মেনু ছোট করুন"}
          className="hidden h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200 md:flex"
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      </div>
    </div>
  );

  const footer = (
    <div className="border-t border-slate-100 p-2 dark:border-slate-800">
      <button
        type="button"
        onClick={handleLogout}
        title="লগআউট"
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-rose-500 transition hover:bg-rose-50 dark:hover:bg-rose-950/40"
      >
        <LogOut size={16} />
        {!collapsed && <span>লগআউট</span>}
      </button>
    </div>
  );

  return (
    <AdminSidebarShell collapsed={collapsed} header={header} footer={footer}>
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={handleClick}
          className={({ isActive }) => navItemClass(isActive)}
        >
          {item.icon}
          {!collapsed && <span>{item.label}</span>}
        </NavLink>
      ))}
    </AdminSidebarShell>
  );
}
