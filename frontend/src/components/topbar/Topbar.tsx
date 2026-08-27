import { useEffect } from "react";
import { useAuthStore } from "../../store/authStore";
import { useBrandingStore } from "../../store/brandingStore";
import LockButton from "../lock/LockButton";
import Button from "../ui/Button";
import ThemeToggle from "../ui/ThemeToggle";
import PlanBadge from "./PlanBadge";
import { LogOut } from "lucide-react";

type TopbarProps = {
  openSidebar: () => void;
};

export default function Topbar({ openSidebar }: TopbarProps) {
  const logout = useAuthStore((s) => s.logout);
  const branding = useBrandingStore((s) => s.branding);
  const fetchBranding = useBrandingStore((s) => s.fetchBranding);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  return (
    <div className="h-16 md:h-20 bg-white border-b border-slate-200 grid grid-cols-[auto_1fr_auto] items-center gap-2 px-3 md:px-4 dark:bg-slate-900 dark:border-slate-800">
      {/* Left: mobile menu */}
      <div className="flex items-center gap-2 min-w-0 justify-self-start">
        <button
          onClick={openSidebar}
          className="md:hidden text-xl p-1 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          ☰
        </button>
      </div>

      {/* মাঝে: লোগো + মাদ্রাসার নাম (পাশাপাশি) ও নিচে ঠিকানা, বড় ফন্টে ও কেন্দ্রে */}
      <div className="flex min-w-0 flex-col items-center justify-center text-center">
        <div className="flex min-w-0 items-center gap-2">
          {branding?.report_logo && (
            <img
              src={branding.report_logo}
              alt={branding.name || "Logo"}
              className="h-9 w-9 md:h-11 md:w-11 shrink-0 rounded-full border border-slate-200 object-cover dark:border-slate-700"
            />
          )}
          {branding?.name && (
            <div className="truncate text-base font-bold text-slate-800 dark:text-slate-100 md:text-xl">
              {branding.name}
            </div>
          )}
        </div>
        {branding?.address && (
          <div className="hidden truncate text-sm text-slate-800 dark:text-slate-100 sm:block">
            {branding.address}
          </div>
        )}
      </div>

      {/* Right: অ্যাকশন বাটন */}
      <div className="flex items-center gap-1 md:gap-3 justify-self-end">
        <PlanBadge />
        <ThemeToggle />
        <LockButton />

        <Button
          variant="danger"
          onClick={logout}
          className="flex items-center justify-center px-2 md:px-3"
        >
          <LogOut size={18} />

          {/* Desktop text */}
          <span className="hidden md:inline ml-1">Logout</span>
        </Button>
      </div>
    </div>
  );
}
