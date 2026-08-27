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

  const brand = (
    <div className="flex min-w-0 items-center gap-2">
      {branding?.report_logo && (
        <img
          src={branding.report_logo}
          alt={branding.name || "Logo"}
          className="h-8 w-8 shrink-0 rounded-full border border-slate-200 object-cover md:h-11 md:w-11 dark:border-slate-700"
        />
      )}
      {branding?.name && (
        <div className="min-w-0 truncate text-sm font-bold text-slate-800 md:text-xl dark:text-slate-100">
          {branding.name}
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full min-w-0 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {/* মোবাইল/ট্যাবলেট: দুই সারি — উপরে ব্র্যান্ড, নিচে স্লিম অ্যাকশন বার */}
      <div className="md:hidden">
        <div className="flex flex-col items-center justify-center gap-0.5 px-3 py-2.5 text-center sm:py-3">
          {brand}
          {branding?.address && (
            <div className="hidden truncate text-sm text-slate-800 sm:block dark:text-slate-100">
              {branding.address}
            </div>
          )}
        </div>

        <div className="flex h-11 items-center gap-2 border-t border-slate-100 bg-slate-50 px-2 sm:h-12 sm:px-3 dark:border-slate-800 dark:bg-slate-800/40">
          <button
            onClick={openSidebar}
            className="shrink-0 rounded-lg p-1.5 text-lg leading-none text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-700"
            aria-label="মেনু খুলুন"
          >
            ☰
          </button>

          <div className="flex flex-1 items-center justify-end gap-1 sm:gap-2">
            <PlanBadge />
            <ThemeToggle />
            <LockButton />

            <Button
              variant="danger"
              onClick={logout}
              className="flex items-center justify-center px-2"
            >
              <LogOut size={17} />
            </Button>
          </div>
        </div>
      </div>

      {/* ডেস্কটপ: আগের মতোই এক লাইনে — ব্র্যান্ড কেন্দ্রে, অ্যাকশন ডানে */}
      <div className="hidden md:grid md:h-20 md:grid-cols-[auto_1fr_auto] md:items-center md:gap-2 md:px-4">
        <div />

        <div className="flex flex-col items-center justify-center text-center">
          {brand}
          {branding?.address && (
            <div className="truncate text-sm text-slate-800 dark:text-slate-100">
              {branding.address}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3 justify-self-end">
          <PlanBadge />
          <ThemeToggle />
          <LockButton />

          <Button
            variant="danger"
            onClick={logout}
            className="flex items-center justify-center px-3"
          >
            <LogOut size={18} />
            <span className="ml-1">Logout</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
