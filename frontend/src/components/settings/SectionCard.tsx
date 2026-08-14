import type { ReactNode } from "react";

export default function SectionCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">{hint}</p>}
      </div>
      {children}
    </div>
  );
}
