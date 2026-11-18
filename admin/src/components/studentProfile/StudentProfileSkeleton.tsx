import { useParams } from "react-router-dom";
import { useLang } from "@madrasha/shared-ui/src/i18n";
import { Skeleton, SkeletonTable } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { studentProfilePageClass } from "./profileStyles";

const cardClass = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-700 dark:bg-slate-900";

export function StudentDetailsSkeleton({ fields = 16 }: { fields?: number }) {
  return <div className={cardClass}>
    <Skeleton className="mb-6 h-6 w-40 motion-reduce:animate-none" />
    <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: fields }, (_, index) => <div key={index} className="min-w-0 space-y-2">
        <Skeleton className="h-3 w-24 max-w-full motion-reduce:animate-none" />
        <Skeleton className="h-10 w-full rounded-lg motion-reduce:animate-none" />
      </div>)}
    </div>
  </div>;
}

export default function StudentProfileSkeleton({ edit = false }: { edit?: boolean }) {
  const lang = useLang();
  const { tab } = useParams();
  const overview = !tab || !["academic", "attendance", "fees", "library"].includes(tab);
  if (!edit) return <div role="status" aria-busy="true" aria-label={lang === "bn" ? "শিক্ষার্থীর তথ্য লোড হচ্ছে" : "Loading student information"} className={`${studentProfilePageClass} space-y-6`}>
    <div aria-hidden="true" className="space-y-6 motion-reduce:[&_.animate-pulse]:animate-none">
      <div className={cardClass}>
        <div className="grid items-center gap-5 lg:grid-cols-2 lg:gap-8">
          <div className="flex gap-4"><Skeleton className="h-24 w-20 shrink-0 rounded-xl" /><div className="min-w-0 flex-1 space-y-3"><Skeleton className="h-3 w-28" /><Skeleton className="h-7 w-52 max-w-full" /><Skeleton className="h-4 w-32" /></div></div>
          <div className="min-w-0 space-y-4 border-t border-slate-100 pt-4 lg:border-s lg:border-t-0 lg:ps-6 lg:pt-0 dark:border-slate-800">
            <div className="grid grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="min-w-0 space-y-2"><Skeleton className="h-3 w-16 max-w-full" /><Skeleton className="h-5 w-20 max-w-full" /></div>)}</div>
            <div className="flex flex-wrap gap-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-9 w-24 rounded-lg" />)}</div>
          </div>
        </div>
      </div>
      <div className="flex gap-3 overflow-hidden border-b border-slate-200 pb-3 dark:border-slate-700">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-8 w-24 shrink-0" />)}</div>
      {overview ? <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><Skeleton className="mb-3 h-3 w-24 max-w-full" /><Skeleton className="h-6 w-20" /></div>)}</div>
        <StudentDetailsSkeleton />
        <StudentDetailsSkeleton fields={12} />
        <StudentDetailsSkeleton fields={8} />
        <StudentDetailsSkeleton fields={4} />
      </> : <SkeletonTable rows={5} columns={tab === "academic" ? 6 : 4} />}
    </div>
  </div>;
  return <div role="status" aria-busy="true" aria-label={lang === "bn" ? "শিক্ষার্থীর তথ্য লোড হচ্ছে" : "Loading student information"} className={`${studentProfilePageClass} space-y-6`}>
    <div aria-hidden="true" className="space-y-6">
      {edit && <Skeleton className="h-16 w-full rounded-xl motion-reduce:animate-none" />}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="space-y-2"><Skeleton className="h-7 w-56 max-w-full" /><Skeleton className="h-4 w-64 max-w-full" /></div>
        <div className="flex flex-wrap gap-2">{Array.from({ length: edit ? 6 : 4 }, (_, i) => <Skeleton key={i} className="h-9 w-24 rounded-lg" />)}</div>
      </div>
      {!edit && <div className="flex gap-3 overflow-hidden border-b border-slate-200 pb-3 dark:border-slate-700">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-8 w-24 shrink-0" />)}</div>}
      {!edit && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className={cardClass}><Skeleton className="mb-3 h-3 w-24" /><Skeleton className="h-8 w-20" /></div>)}</div>}
      {edit || overview ? <>
        {!edit && <StudentDetailsSkeleton fields={6} />}
        <div className={cardClass}><Skeleton className="mb-5 h-6 w-32" /><Skeleton className="mx-auto h-40 w-40 rounded-xl" /></div>
        <StudentDetailsSkeleton />
        <StudentDetailsSkeleton fields={12} />
        {edit && <StudentDetailsSkeleton fields={8} />}
        <StudentDetailsSkeleton fields={4} />
      </> : <SkeletonTable rows={5} columns={tab === "academic" ? 6 : 4} />}
    </div>
  </div>;
}

export function StudentReadOnlySkeleton({ fields = 8, singleColumn = false }: { fields?: number; singleColumn?: boolean }) {
  return <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
    <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800"><Skeleton className="h-5 w-36" /></div>
    <div className={`grid gap-x-6 px-5 py-1 ${singleColumn ? "" : "sm:grid-cols-2"}`}>
      {Array.from({ length: fields }, (_, i) => <div key={i} className="space-y-2 border-b border-slate-100 py-3 dark:border-slate-800"><Skeleton className="h-3 w-20" /><Skeleton className="h-5 w-3/4" /></div>)}
    </div>
  </div>;
}
