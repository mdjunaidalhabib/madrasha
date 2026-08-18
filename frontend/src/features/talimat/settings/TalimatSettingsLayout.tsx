import { NavLink, Outlet, useParams } from "react-router-dom";
import { Settings2, Layers, ClipboardCheck, BarChart3, FileBadge2, CalendarRange } from "lucide-react";
import { getTenantAdminBase } from "../../../utils/tenantSlug";
import { prefetchAdminRoute } from "../../../app/routePrefetch";

const SETTINGS_NAV_ITEMS = [
  { key: "class-book", label: "বিভাগ শ্রেণী কিতাব", icon: Layers },
  { key: "exam", label: "পরীক্ষা", icon: ClipboardCheck },
  { key: "grade", label: "গ্রেড", icon: BarChart3 },
  { key: "documents", label: "ডকুমেন্টস টেমপ্লেট", icon: FileBadge2 },
  { key: "sessions", label: "সেশন সেটআপ", icon: CalendarRange },
];

function navPillClass(isActive: boolean) {
  return `group relative flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition sm:w-full ${
    isActive
      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
  }`;
}

function iconChipClass(isActive: boolean) {
  return `flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition ${
    isActive
      ? "bg-indigo-600 text-white dark:bg-indigo-500"
      : "bg-slate-100 text-slate-500 group-hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-slate-700"
  }`;
}

export default function TalimatSettingsLayout() {
  const { madrasaSlug = "" } = useParams();
  const adminBase = getTenantAdminBase(madrasaSlug);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        <Settings2 size={16} />
        সেটিং
      </div>

      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <nav
          aria-label="সেটিং মেনু"
          className="flex shrink-0 gap-2 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:w-64 sm:flex-col sm:overflow-visible"
        >
          {SETTINGS_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.key}
                to={`${adminBase}/talimat/settings/${item.key}`}
                onMouseEnter={() => prefetchAdminRoute(`talimat/settings/${item.key}`)}
                onFocus={() => prefetchAdminRoute(`talimat/settings/${item.key}`)}
                className={({ isActive }) => navPillClass(isActive)}
              >
                {({ isActive }) => (
                  <>
                    <span aria-hidden="true" className={iconChipClass(isActive)}>
                      <Icon size={15} />
                    </span>
                    <span className="whitespace-nowrap sm:whitespace-normal">{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
