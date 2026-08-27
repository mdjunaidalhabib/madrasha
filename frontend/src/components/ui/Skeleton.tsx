export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 dark:bg-slate-700 ${className}`} />;
}

export function SkeletonText({
  className = "",
  width = "w-full",
}: {
  className?: string;
  width?: string;
}) {
  return <Skeleton className={`h-4 ${width} ${className}`} />;
}

export function SkeletonAvatar({ size = "h-16 w-16" }: { size?: string }) {
  return <Skeleton className={`${size} rounded-full`} />;
}

export function SkeletonTable({
  rows = 6,
  columns = 5,
  className = "",
  bordered = true,
  shadowed = true,
}: {
  rows?: number;
  columns?: number;
  className?: string;
  /** Set to false to render without the outer border - a "border-0" class
   * added via `className` isn't reliable here since it and the base
   * "border" class have equal CSS specificity, so whichever rule Tailwind
   * happens to emit last wins regardless of class order in the string. */
  bordered?: boolean;
  shadowed?: boolean;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl bg-white dark:bg-slate-900 ${
        bordered ? "border border-gray-200 dark:border-slate-700" : ""
      } ${shadowed ? "shadow-sm" : ""} ${className}`}
    >
      <div className="flex gap-4 border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-gray-100 dark:divide-slate-800">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 px-4 py-3">
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton key={c} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonCard({
  lines = 4,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 ${className}`}>
      <div className="flex items-center gap-4">
        <SkeletonAvatar />
        <div className="flex-1 space-y-2">
          <SkeletonText width="w-1/3" />
          <SkeletonText width="w-1/4" className="h-3" />
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonText key={i} width={i % 2 ? "w-2/3" : "w-full"} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonList({
  items = 5,
  className = "",
}: {
  items?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <SkeletonAvatar size="h-10 w-10" />
          <div className="flex-1 space-y-2">
            <SkeletonText width="w-1/3" />
            <SkeletonText width="w-1/2" className="h-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonBlock({ className = "h-40 w-full" }: { className?: string }) {
  return <Skeleton className={className} />;
}

export function SkeletonChart({ className = "h-64" }: { className?: string }) {
  return <Skeleton className={`w-full ${className}`} />;
}
