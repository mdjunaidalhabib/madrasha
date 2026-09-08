import type { ReactNode } from "react";
import { ToggleSwitch } from "./ToggleSwitch";

export default function SectionCard({
  title,
  hint,
  children,
  toggle,
  badge,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  /** সেকশনটি সক্রিয়/নিষ্ক্রিয় করার টগল (হেডারের ডানে দেখায়) - নিষ্ক্রিয় হলে
   * ভেতরের সব ফিল্ড disabled হয়ে যায়, সেকশন হাইড হয় না। */
  toggle?: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean };
  /** হেডারের ডান পাশে একটি ছোট কাউন্ট/লেবেল ব্যাজ (যেমনঃ মোট কয়টি আইটেম আছে)। */
  badge?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">{hint}</p>}
        </div>
        {badge && (
          <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
            {badge}
          </span>
        )}
        {toggle && (
          <div className="flex shrink-0 items-center gap-2">
            {!toggle.checked && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500 dark:bg-slate-800 dark:text-slate-400">
                নিষ্ক্রিয়
              </span>
            )}
            <ToggleSwitch checked={toggle.checked} onChange={toggle.onChange} disabled={toggle.disabled} />
          </div>
        )}
      </div>
      {toggle && !toggle.checked ? (
        <div className="pointer-events-none opacity-40">{children}</div>
      ) : (
        children
      )}
    </div>
  );
}
