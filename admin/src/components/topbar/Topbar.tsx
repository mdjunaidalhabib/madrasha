import { useEffect, useState } from "react";
import { useBrandingStore } from "../../store/brandingStore";
import { useNowLabels } from "../../hooks/useNowLabels";
import LockButton from "../lock/LockButton";
import ThemeToggle from "@madrasha/shared-ui/src/components/ui/ThemeToggle";
import { LanguageSwitcher, useText } from "@madrasha/shared-ui/src/i18n";
import { shellText } from "./shell.text";
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
  const t = useText(shellText);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => setLogoFailed(false), [branding?.report_logo]);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  const iconButtonClass =
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-teal-200 bg-white text-teal-500 transition hover:bg-teal-50 hover:text-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:border-teal-800 dark:bg-slate-900 dark:text-teal-400 dark:hover:bg-teal-950";

  const actionBorderClass =
    "!h-10 !w-10 !rounded-xl !border !border-teal-200 !text-teal-700 hover:!border-teal-400 hover:!bg-teal-50 dark:!border-teal-800 dark:!text-teal-300 dark:hover:!bg-teal-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 focus-visible:ring-offset-2";

  return (
    <header className="admin-shell-header z-20 w-full min-w-0 shrink-0 border-b-0 border-t-0 border-teal-200 border-t-teal-600 bg-white dark:border-teal-900 dark:border-t-teal-400 dark:bg-slate-900 md:border-b md:border-t-2">
      {/* Mobile institution name and menu, with the date and time below. */}
      <div className="md:hidden">
        <div className="flex min-h-14 items-center gap-2 border-b border-teal-200 px-3 pt-2.5 pb-1 dark:border-teal-900">
          {branding?.report_logo && !logoFailed && (
            <img
              src={branding.report_logo}
              alt=""
              onError={() => setLogoFailed(true)}
              className="h-11 w-11 shrink-0 rounded-full border border-teal-200 bg-white object-cover dark:border-teal-800"
            />
          )}
          <div className="min-w-0 flex-1 whitespace-normal break-words px-1 pt-1 text-center text-lg font-bold leading-snug text-teal-700 dark:text-teal-300">
            {branding?.name}
            {branding?.address && (
              <span className="mt-0.5 block text-xs font-normal leading-normal text-teal-700 dark:text-teal-300">
                {branding.address}
              </span>
            )}
          </div>
          <button onClick={openSidebar} className={`${iconButtonClass} mt-0.5 self-start`} aria-label={t.openMenu}>
            <Menu size={17} strokeWidth={1.5} />
          </button>
        </div>

        {/* প্ল্যান/থিম/লক আইকন এখন মোবাইল ড্রয়ারে (Sidebar.tsx) - এখানে শুধু
            তারিখ-সময় */}
        <div className="flex min-h-10 items-center justify-center bg-slate-50 px-3 py-1.5 dark:bg-slate-800/40">
          <div className="flex min-w-0 flex-wrap items-center justify-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[0.75rem] font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400">
            <Calendar size={12} className="shrink-0" />
            <span className="truncate">{today}</span>
            <span className="h-3 w-px shrink-0 bg-emerald-300 dark:bg-emerald-800" />
            <Clock size={12} className="shrink-0" />
            <span className="shrink-0 tabular-nums">{nowTime}</span>
          </div>
        </div>
      </div>

      {/* Keep tablet actions on their own row so long institution names remain readable. */}
      <div className="hidden md:flex md:h-full md:flex-wrap md:content-center md:items-center md:gap-x-4 md:gap-y-2 md:ps-24 md:pe-6 md:py-3 xl:flex-nowrap">
        <div className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap px-1 py-1 text-2xl font-bold leading-normal text-teal-700 dark:text-teal-300" tabIndex={0}>
          {branding?.name && (
            <span>
              {branding.name}
            </span>
          )}
          {branding?.address && (
            <span className="ms-2">
              {branding?.name && <span aria-hidden="true">· </span>}
              {branding.address}
            </span>
          )}
        </div>

        <div className="flex w-full shrink-0 items-center justify-end gap-2 xl:w-auto">
          <PlanBadge />
          <LanguageSwitcher />
          <ThemeToggle className={actionBorderClass} />
          <LockButton className={actionBorderClass} />
          <ProfileMenu className={actionBorderClass} />
        </div>
      </div>
    </header>
  );
}
