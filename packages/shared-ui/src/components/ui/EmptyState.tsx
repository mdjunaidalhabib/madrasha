import { ReactNode } from "react";
import { commonText, useText } from "../../i18n";

export default function EmptyState({
  title,
  hint,
  action,
}: {
  title?: string;
  hint?: string;
  action?: ReactNode;
}) {
  const c = useText(commonText);
  return (
    <div className="rounded bg-white p-8 text-center shadow dark:bg-slate-900">
      <div className="text-2xl">📭</div>
      <h3 className="mt-2 text-lg font-semibold dark:text-slate-100">{title ?? c.noData}</h3>
      {hint && <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
