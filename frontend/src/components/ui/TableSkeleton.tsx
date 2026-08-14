export default function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="rounded bg-white p-4 shadow dark:bg-slate-900">
      <div className="h-5 w-40 animate-pulse rounded bg-gray-200 dark:bg-slate-700" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-gray-100 dark:bg-slate-800" />
        ))}
      </div>
    </div>
  );
}
