import { ReactElement, useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import AdminSidebarShell from "@madrasha/shared-ui/src/components/shell/AdminSidebarShell";
import { useAdminAuthStore } from "../../store/adminAuthStore";
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

type NavItem = { to: string; label: string; icon: ReactElement; end?: boolean; group: string };

// পাঁচটি লজিক্যাল গ্রুপে সাজানো - সাইডবারে গ্রুপ-হেডিং দেখানোর জন্য প্রতিটি
// আইটেমে group ট্যাগ করা থাকে, নিচের রেন্ডারে সেই গ্রুপ অনুযায়ী ভাগ করে
// দেখানো হয়। ফ্ল্যাট অ্যারে-ই থাকছে (breadcrumb হুক এটাকে ফ্ল্যাট হিসেবে খোঁজে)।
export const SUPER_ADMIN_NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "ড্যাশবোর্ড", icon: <LayoutDashboard size={18} />, end: true, group: "মূল" },

  { to: "/madrasas", label: "মাদরাসাসমূহ", icon: <School size={18} />, end: true, group: "মাদরাসা ব্যবস্থাপনা" },
  { to: "/madrasas/trash", label: "ট্র্যাশ", icon: <Trash2 size={18} />, group: "মাদরাসা ব্যবস্থাপনা" },
  { to: "/plans", label: "প্ল্যানসমূহ", icon: <CreditCard size={18} />, group: "মাদরাসা ব্যবস্থাপনা" },

  { to: "/document-templates", label: "ডকুমেন্ট টেমপ্লেট", icon: <FileStack size={18} />, group: "কন্টেন্ট ও ক্যাটালগ" },
  { to: "/catalog", label: "একাডেমিক ক্যাটালগ", icon: <Layers size={18} />, group: "কন্টেন্ট ও ক্যাটালগ" },
  { to: "/fee-structure-templates", label: "ফি টেমপ্লেট", icon: <Wallet size={18} />, group: "কন্টেন্ট ও ক্যাটালগ" },
  { to: "/important-links", label: "গুরুত্বপূর্ণ লিংক", icon: <Link2 size={18} />, group: "কন্টেন্ট ও ক্যাটালগ" },
  { to: "/vendor-promo", label: "Hikmah IT প্রোমো", icon: <Megaphone size={18} />, group: "কন্টেন্ট ও ক্যাটালগ" },
  { to: "/websites", label: "ওয়েবসাইটসমূহ", icon: <Globe2 size={18} />, group: "কন্টেন্ট ও ক্যাটালগ" },

  // বিলিং (SMS/Email credit বিক্রয়)
  { to: "/billing/sms-packages", label: "SMS প্যাকেজ", icon: <Send size={18} />, group: "বিলিং" },
  { to: "/billing/email-packages", label: "Email প্যাকেজ", icon: <Mail size={18} />, group: "বিলিং" },
  { to: "/billing/requests", label: "বিলিং রিকোয়েস্ট", icon: <ClipboardList size={18} />, group: "বিলিং" },
  { to: "/billing/pricing", label: "বিলিং প্রাইসিং", icon: <Tags size={18} />, group: "বিলিং" },
  { to: "/billing/reports", label: "বিলিং রিপোর্ট", icon: <BarChart3 size={18} />, group: "বিলিং" },

  { to: "/settings", label: "সেটিংস", icon: <Settings size={18} />, group: "সেটিংস" },
];

// রেন্ডারের সময় ব্যবহারের জন্য group অনুযায়ী ভাগ করা - Map ইনসার্শন-অর্ডার
// ধরে রাখে, তাই উপরের অ্যারের ক্রমই গ্রুপগুলোর ক্রম নির্ধারণ করে।
function groupNavItems(items: NavItem[]) {
  const groups = new Map<string, NavItem[]>();
  for (const item of items) {
    const list = groups.get(item.group);
    if (list) list.push(item);
    else groups.set(item.group, [item]);
  }
  return Array.from(groups.entries());
}

function navItemClass(isActive: boolean) {
  return `flex items-center gap-2 rounded-lg border-l-2 px-3 py-2 text-base font-medium transition ${
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
const GROUP_ICONS: Record<string, ReactElement> = {
  "মাদরাসা ব্যবস্থাপনা": <School size={18} />,
  "কন্টেন্ট ও ক্যাটালগ": <Layers size={18} />,
  "বিলিং": <Wallet size={18} />,
};

export default function SuperAdminSidebar({
  collapsed,
  onToggleCollapse,
  closeSidebar,
}: SuperAdminSidebarProps) {
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
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  useEffect(() => {
    if (activeGroup) setOpenGroup(activeGroup);
  }, [activeGroup]);
  const toggleGroup = (group: string) => {
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
            সুপার অ্যাডমিন
          </span>
          <span className="block break-words text-xs text-slate-400 dark:text-slate-500">
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
                title={collapsed ? item.label : undefined}
                className={({ isActive }) => navItemClass(isActive)}
              >
                {item.icon}
                {!collapsed && <span>{item.label}</span>}
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
              title={collapsed ? group : undefined}
              className={groupHeaderClass(isActive)}
            >
              {GROUP_ICONS[group] || <Layers size={18} />}
              {!collapsed && <span className="flex-1 text-left">{group}</span>}
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
              <div className="ml-6 space-y-1 overflow-hidden border-l border-slate-200 pl-3 dark:border-slate-700">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={handleClick}
                    className={({ isActive: linkActive }) => childItemClass(linkActive)}
                  >
                    <span>{item.label}</span>
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
