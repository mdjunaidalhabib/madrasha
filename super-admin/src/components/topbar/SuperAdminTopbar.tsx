import { useAdminAuthStore } from "../../store/adminAuthStore";
import ThemeToggle from "@madrasha/shared-ui/src/components/ui/ThemeToggle";
import { commonText, useText } from "@madrasha/shared-ui/src/i18n";
import { shellText } from "../sidebar/shell.text";
import { useNavigate } from "react-router-dom";
import { GraduationCap, LogOut, Menu } from "lucide-react";

type SuperAdminTopbarProps = {
  openSidebar: () => void;
};

export default function SuperAdminTopbar({ openSidebar }: SuperAdminTopbarProps) {
  const admin = useAdminAuthStore((s) => s.admin);
  const logout = useAdminAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const t = useText(shellText);
  const c = useText(commonText);

  return (
    <div className="flex min-h-16 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900 md:px-5">
      <div className="flex min-w-0 items-center gap-2 md:gap-3">
        <button
          type="button"
          onClick={openSidebar}
          aria-label={t.openMenu}
          className="rounded-lg p-1 text-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden"
        >
          <Menu size={22} aria-hidden="true" />
        </button>
        <span aria-hidden="true" className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300 sm:flex">
          <GraduationCap size={23} />
        </span>
        <div className="min-w-0">
          <p className="text-lg font-bold leading-6 tracking-wide text-slate-900 dark:text-white">EMS</p>
          <p className="text-xs leading-4 text-slate-500 dark:text-slate-400 sm:text-sm">Education Management System</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {admin && <span className="hidden max-w-40 truncate text-sm font-medium text-slate-700 dark:text-slate-200 lg:block">{admin.name}</span>}
        <ThemeToggle />
        <button
          type="button"
          onClick={() => {
            logout();
            navigate("/login", { replace: true });
          }}
          className="flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
        >
          <LogOut size={17} aria-hidden="true" />
          <span>{c.logout}</span>
        </button>
      </div>
    </div>
  );
}
