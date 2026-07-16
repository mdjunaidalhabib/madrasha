export default function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="rounded bg-white p-4 shadow">
      <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />
        ))}
      </div>
    </div>
  );
}
