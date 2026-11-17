import { useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Settings2, type LucideIcon } from "lucide-react";

type Props = {
  title: string;
  activeLabel: string;
  activeIcon?: LucideIcon;
  children: ReactNode;
};

export default function ResponsiveSettingsMenu({ title, activeLabel, activeIcon: Icon = Settings2, children }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <aside
      className="settings-sidebar no-print min-w-0 self-start rounded-2xl border border-gray-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:sticky lg:top-4"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          triggerRef.current?.focus();
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-start text-slate-900 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-100 dark:hover:bg-slate-800 lg:hidden"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
          <Icon size={20} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">{title}</span>
          <span className="block truncate text-sm font-semibold">{activeLabel}</span>
        </span>
        <ChevronDown size={18} aria-hidden="true" className={`shrink-0 text-slate-400 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
      </button>
      <div className="mb-2 hidden rounded-lg bg-blue-800 px-3 py-2 text-white lg:block">
        <h2 className="text-base font-bold">{title}</h2>
      </div>
      <nav
        id={panelId}
        aria-label={title}
        className={`${open ? "block" : "hidden"} mt-2 max-h-[min(60dvh,26rem)] space-y-1 overflow-y-auto border-t border-slate-100 pt-2 dark:border-slate-800 [&_a]:min-h-11 [&_button]:min-h-11 lg:mt-0 lg:block lg:max-h-none lg:overflow-visible lg:border-0 lg:pt-0 lg:[&_a]:min-h-0 lg:[&_button]:min-h-0`}
        onClick={(event) => {
          if ((event.target as Element).closest("a, button") && open) {
            setOpen(false);
            triggerRef.current?.focus();
          }
        }}
      >
        {children}
      </nav>
    </aside>
  );
}
