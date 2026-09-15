import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

const DEFAULT_SELECT_CLASS =
  "h-9 w-full appearance-none rounded-md border border-gray-300 px-3 pr-7 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500";

const DEFAULT_ICON_CLASS =
  "pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 transition-transform duration-200 dark:text-slate-500";

/** A native <select> with a custom chevron that actually tracks the
 * dropdown's open/closed state (native `:focus` alone can't - clicking an
 * already-focused select to CLOSE it doesn't blur it, so a `peer-focus`
 * chevron would stay "open" forever after that first close). Tracked
 * ourselves instead: mousedown toggles when the select is already the
 * focused element (that click is closing it), opens it otherwise; blur/
 * change/Escape close it; Enter/Space toggle it. */
export default function FilterSelect({
  value,
  onChange,
  disabled,
  wrapperClassName,
  selectClassName = DEFAULT_SELECT_CLASS,
  iconClassName = DEFAULT_ICON_CLASS,
  children,
}: {
  value: string | number;
  onChange: (value: string) => void;
  disabled?: boolean;
  wrapperClassName?: string;
  selectClassName?: string;
  iconClassName?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`relative ${wrapperClassName ?? ""}`}>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(false);
        }}
        onMouseDown={(event) => {
          setOpen(document.activeElement === event.currentTarget ? (prev) => !prev : true);
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          else if (event.key === "Enter" || event.key === " ") setOpen((prev) => !prev);
        }}
        className={selectClassName}
      >
        {children}
      </select>
      <ChevronDown className={`${iconClassName} ${open ? "rotate-180" : ""}`} />
    </div>
  );
}
