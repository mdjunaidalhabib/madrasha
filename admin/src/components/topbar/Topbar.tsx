import { useEffect, useState } from "react";
import { useBrandingStore } from "../../store/brandingStore";
import { useNowLabels } from "../../hooks/useNowLabels";
import LockButton from "../lock/LockButton";
import ThemeToggle from "@madrasha/shared-ui/src/components/ui/ThemeToggle";
import PlanBadge from "./PlanBadge";
import ProfileMenu from "./ProfileMenu";
import { Calendar, Clock, Menu } from "lucide-react";

type TopbarProps = {
  openSidebar: () => void;
};

export default function Topbar({ openSidebar }: TopbarProps) {
  const branding = useBrandingStore((s) => s.branding);
  const fetchBranding = useBrandingStore((s) => s.fetchBranding);
  const { date: today, time: nowTime } = useNowLabels();

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  // লোগো ফাইল ভাঙা হলে alt-এ মাদরাসার নাম আবার লেখা হয়ে দুবার নাম দেখাত -
  // তাই লোড ব্যর্থ হলে লোগোটাই লুকিয়ে ফেলি।
  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => setLogoFailed(false), [branding?.report_logo]);

  const logo = branding?.report_logo && !logoFailed && (
    <img
      src={branding.report_logo}
      alt=""
      onError={() => setLogoFailed(true)}
      className="h-11 w-11 shrink-0 rounded-full border border-slate-200 object-cover md:h-12 md:w-12 dark:border-slate-700"
    />
  );

  const iconButtonClass =
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800";

  return (
    <div className="w-full min-w-0 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {/* মোবাইল/ট্যাবলেট: উপরে লোগো-নাম-মেনু এক সারিতে, নিচে স্লিম অ্যাকশন বার */}
      <div className="md:hidden">
        <div className="flex items-center gap-2 px-3 py-2.5">
          {logo}
          <div className="min-w-0 flex-1 break-words text-center text-lg font-bold leading-tight text-slate-800 dark:text-slate-100">
            {branding?.name}
          </div>
          <button
            onClick={openSidebar}
            className={iconButtonClass}
            aria-label="মেনু খুলুন"
          >
            <Menu size={17} />
          </button>
        </div>

        {/* প্ল্যান/থিম/লক আইকন এখন মোবাইল ড্রয়ারে (Sidebar.tsx) - এখানে শুধু
            তারিখ-সময় */}
        <div className="flex h-10 items-center justify-center border-t border-slate-100 bg-slate-50 px-3 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="flex min-w-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400">
            <Calendar size={12} className="shrink-0" />
            <span className="truncate">{today}</span>
            <span className="h-3 w-px shrink-0 bg-emerald-300 dark:bg-emerald-800" />
            <Clock size={12} className="shrink-0" />
            <span className="shrink-0 tabular-nums">{nowTime}</span>
          </div>
        </div>
      </div>

      {/* ডেস্কটপ: বাম পাশে লোগো+নাম (ঠিকানাসহ একই লাইনে), ডান পাশে অ্যাকশন -
          কোনো সেন্টারিং নেই, বাম থেকে সহজভাবে শুরু */}
      <div className="hidden md:flex md:h-20 md:items-center md:gap-3 md:pl-32 md:pr-4">
        {logo}
        <div className="min-w-0 flex-1 truncate">
          {branding?.name && (
            <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {branding.name}
            </span>
          )}
          {branding?.address && (
            <span className="ml-2 text-2xl font-bold text-slate-800 dark:text-slate-100">
              {branding?.name && "• "}
              {branding.address}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <PlanBadge />
          <ThemeToggle />
          <LockButton />
          <ProfileMenu />
        </div>
      </div>
    </div>
  );
}
