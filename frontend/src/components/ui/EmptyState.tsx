import { ReactNode } from "react";

export default function EmptyState({
  title = "No data",
  hint,
  action,
}: {
  title?: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded bg-white p-8 text-center shadow dark:bg-slate-900">
      <div className="text-2xl">📭</div>
      <h3 className="mt-2 text-lg font-semibold dark:text-slate-100">{title}</h3>
      {hint && <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
