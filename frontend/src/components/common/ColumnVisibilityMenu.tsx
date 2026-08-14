import { useEffect, useRef, useState } from "react";
import { type ColumnOption } from "../../hooks/useColumnVisibility";

type Props<T extends string> = {
  columns: ColumnOption<T>[];
  visible: Set<T>;
  onToggle: (key: T) => void;
  onReset: () => void;
};

const ColumnVisibilityMenu = <T extends string>({ columns, visible, onToggle, onReset }: Props<T>) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-9 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15M4.5 9h15M4.5 15h15" />
        </svg>
        কলাম
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <p className="mb-1 px-1 text-xs font-semibold text-gray-500 dark:text-slate-400">কলাম দেখান / লুকান</p>

          <div className="max-h-64 overflow-y-auto">
            {columns.map((col) => (
              <label
                key={col.key}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <input
                  type="checkbox"
                  checked={visible.has(col.key)}
                  onChange={() => onToggle(col.key)}
                  className="h-4 w-4 rounded border-gray-300 dark:border-slate-600"
                />
                {col.label}
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={onReset}
            className="mt-1 w-full rounded-md border-t border-gray-100 px-2 py-1.5 text-left text-xs text-blue-600 hover:bg-blue-50 dark:border-slate-800 dark:text-blue-400 dark:hover:bg-blue-950/40"
          >
            সব দেখান (ডিফল্ট)
          </button>
        </div>
      )}
    </div>
  );
};

export default ColumnVisibilityMenu;
