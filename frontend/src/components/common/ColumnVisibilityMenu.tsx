import { useEffect, useRef, useState } from "react";
import { type ColumnOption } from "../../hooks/useColumnVisibility";

type Props<T extends string> = {
  columns: ColumnOption<T>[];
  visible: Set<T>;
  onToggle: (key: T) => void;
  onReset: () => void;
  /** কলাম দেখানোর ক্রম (দেওয়া না হলে `columns`-এর ক্রমে দেখানো হয়, রিঅর্ডার বোতাম আসে না)। */
  order?: T[];
  /** একটা কলামকে ক্রমের মধ্যে আগে/পরে সরাতে — `order` দিলে অবশ্যই এটাও দিতে হবে। */
  onMove?: (key: T, direction: -1 | 1) => void;
};

const ColumnVisibilityMenu = <T extends string>({
  columns,
  visible,
  onToggle,
  onReset,
  order,
  onMove,
}: Props<T>) => {
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

  const columnByKey = new Map(columns.map((col) => [col.key, col]));
  const orderedColumns = order ? order.map((key) => columnByKey.get(key)).filter((c): c is ColumnOption<T> => !!c) : columns;

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
        <div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <p className="mb-1 px-1 text-xs font-semibold text-gray-500 dark:text-slate-400">কলাম দেখান / লুকান</p>
          {onMove && (
            <p className="mb-1 px-1 text-[11px] text-gray-400 dark:text-slate-500">
              তীর বোতাম দিয়ে কলামের ক্রম আগে-পরে করা যাবে
            </p>
          )}

          <div className="max-h-72 overflow-y-auto">
            {orderedColumns.map((col, index) => (
              <div
                key={col.key}
                className="flex items-center gap-1 rounded-md px-1 py-1 hover:bg-gray-50 dark:hover:bg-slate-800"
              >
                <label className="flex flex-1 cursor-pointer items-center gap-2 px-1 py-0.5 text-sm text-gray-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={visible.has(col.key)}
                    onChange={() => onToggle(col.key)}
                    className="h-4 w-4 rounded border-gray-300 dark:border-slate-600"
                  />
                  {col.label}
                </label>

                {onMove && (
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => onMove(col.key, -1)}
                      disabled={index === 0}
                      title="আগে সরান"
                      className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => onMove(col.key, 1)}
                      disabled={index === orderedColumns.length - 1}
                      title="পরে সরান"
                      className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
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
