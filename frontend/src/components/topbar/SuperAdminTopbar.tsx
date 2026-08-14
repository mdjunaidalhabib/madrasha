import { useAdminAuthStore } from "../../store/adminAuthStore";
import ThemeToggle from "../ui/ThemeToggle";

type SuperAdminTopbarProps = {
  openSidebar: () => void;
};

export default function SuperAdminTopbar({ openSidebar }: SuperAdminTopbarProps) {
  const admin = useAdminAuthStore((s) => s.admin);

  return (
    <div className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900 md:px-4">
      <div className="flex min-w-0 items-center gap-2 md:gap-3">
        <button
          onClick={openSidebar}
          className="rounded-lg p-1 text-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden"
        >
          ☰
        </button>
        <div className="truncate text-sm text-slate-600 dark:text-slate-300">
          {admin ? (
            <>
              <span className="text-slate-400 dark:text-slate-500">স্বাগতম,</span>{" "}
              <span className="font-medium text-slate-800 dark:text-slate-100">{admin.name}</span>
            </>
          ) : (
            ""
          )}
        </div>
      </div>
      <ThemeToggle />
    </div>
  );
}
