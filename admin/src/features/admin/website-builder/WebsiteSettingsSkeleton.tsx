import { useLocation } from "react-router-dom";
import { useLang, useText } from "@madrasha/shared-ui/src/i18n";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import { Skeleton } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { websiteShellText } from "./websiteShell.text";

export const websiteSettingsGridClass = "grid grid-cols-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-24";
export const websiteSettingsContentClass = "min-w-0 max-w-4xl space-y-6";
const cardClass = "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900";

function Placeholder({ className }: { className: string }) {
  return <Skeleton className={`motion-reduce:animate-none ${className}`} />;
}

export function WebsiteSettingsContentSkeleton({ tab = "general" }: { tab?: string }) {
  const lang = useLang();
  return <div role="status" aria-busy="true" aria-label={lang === "bn" ? "ওয়েবসাইট সেটিংস লোড হচ্ছে" : "Loading website settings"} className="space-y-6">
    <div aria-hidden="true" className="space-y-6">
      {tab === "general" && <div className={`${cardClass} flex items-center gap-3 border-2`}>
        <Placeholder className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="flex-1 space-y-2"><Placeholder className="h-4 w-48 max-w-full" /><Placeholder className="h-3 w-full" /><Placeholder className="h-3 w-2/3 sm:hidden" /></div>
        <Placeholder className="h-6 w-11 shrink-0 rounded-full" />
      </div>}
      <div className={cardClass}>
        <div className="mb-4 flex items-start justify-between gap-3"><div className="flex-1 space-y-2"><Placeholder className="h-5 w-44 max-w-full" /><Placeholder className="h-3 w-3/4" /></div><Placeholder className="h-6 w-11 shrink-0 rounded-full" /></div>
        {tab === "general" ? <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 12 }, (_, index) => <div key={index} className="flex min-h-[78px] items-center justify-between gap-4 rounded-xl border border-gray-200 p-4 dark:border-slate-700"><div className="flex-1 space-y-2"><Placeholder className={`h-4 ${index % 2 ? "w-2/3" : "w-3/4"}`} /><Placeholder className="h-3 w-full" /></div><Placeholder className="h-6 w-11 shrink-0 rounded-full" /></div>)}
        </div> : <div className="space-y-2">
          {Array.from({ length: 3 }, (_, index) => <div key={index} className="space-y-2 rounded-xl border border-gray-100 px-4 py-3 dark:border-slate-800"><Placeholder className="h-3 w-28" /><Placeholder className={`h-4 ${index ? "w-full" : "w-2/3"}`} />{index > 0 && <Placeholder className="h-4 w-3/4" />}</div>)}
        </div>}
      </div>
      {tab !== "general" && <div className={cardClass}><div className="mb-4 flex items-center justify-between gap-3"><Placeholder className="h-5 w-32" /><Placeholder className="h-10 w-32 rounded-xl" /></div><div className="space-y-2 rounded-xl border border-gray-100 px-4 py-3 dark:border-slate-800"><Placeholder className="h-4 w-1/3" /><Placeholder className="h-4 w-2/3" /><Placeholder className="h-3 w-1/2" /></div></div>}
    </div>
  </div>;
}

export default function WebsiteSettingsSkeleton({ tab, menuCount = 12 }: { tab?: string; menuCount?: number }) {
  const t = useText(websiteShellText);
  const location = useLocation();
  const activeTab = tab ?? new URLSearchParams(location.search).get("tab") ?? "general";
  return <div data-website-settings-skeleton className="min-w-0 space-y-6 pb-8 md:pb-12">
    <div className={websiteSettingsGridClass}>
      <aside aria-hidden="true" className="self-start rounded-2xl border border-gray-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:sticky lg:top-4">
        <div className="mb-2 rounded-lg bg-blue-800 px-3 py-2 text-white"><h2 className="text-base font-bold">{t.settingsMenu}</h2></div>
        <div className="space-y-1">{Array.from({ length: menuCount }, (_, index) => <div key={index} className="flex h-[38px] items-center gap-2 rounded-md border border-slate-200 px-2.5 py-2 dark:border-slate-700"><Placeholder className="h-4 w-4 shrink-0" /><Placeholder className={`h-3 ${index % 3 === 0 ? "w-3/4" : "w-1/2"}`} /></div>)}</div>
      </aside>
      <div className={websiteSettingsContentClass}>
        <PageHeader title={t.title} subtitle={t.subtitle} actions={<div aria-hidden="true"><Placeholder className="h-10 w-[148px] rounded-full" /></div>} />
        <WebsiteSettingsContentSkeleton tab={activeTab} />
      </div>
    </div>
  </div>;
}
