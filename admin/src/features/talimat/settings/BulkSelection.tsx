import { useEffect, useRef } from "react";
import { Copy, Trash2 } from "lucide-react";
import { useText } from "@madrasha/shared-ui/src/i18n";
import { talimatSettingsText } from "./talimatSettings.text";

export const selectionCheckboxClass = "h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 accent-blue-600 disabled:cursor-not-allowed";

export default function BulkSelection({ ids, selected, onChange, onAction, disabled, formatCount }: {
  ids: number[];
  selected: number[];
  onChange: (ids: number[]) => void;
  onAction: (action: "duplicate" | "delete") => void;
  disabled: boolean;
  formatCount: (count: number) => string;
}) {
  const t = useText(talimatSettingsText);
  const checkbox = useRef<HTMLInputElement>(null);
  const count = ids.filter((id) => selected.includes(id)).length;
  useEffect(() => {
    if (checkbox.current) checkbox.current.indeterminate = count > 0 && count < ids.length;
  }, [count, ids.length]);

  if (!ids.length) return null;
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-2 text-xs text-gray-600 dark:bg-slate-800 dark:text-slate-300">
      <label className="flex cursor-pointer items-center gap-2">
        <input ref={checkbox} type="checkbox" className={selectionCheckboxClass}
          checked={count === ids.length} disabled={disabled}
          onChange={(event) => onChange(event.target.checked ? ids : [])} />
        {t.selectAll}
      </label>
      {count > 0 && <>
        <span role="status">{t.selectedCount(formatCount(count))}</span>
        <button type="button" disabled={disabled} onClick={() => onChange([])} className="text-blue-600 hover:underline dark:text-blue-400">{t.clearSelection}</button>
        <div className="ms-auto flex gap-1">
          <button type="button" disabled={disabled} onClick={() => onAction("duplicate")} aria-label={t.duplicateSelected} title={t.duplicateSelected} className="rounded p-1.5 text-emerald-600 hover:bg-emerald-100 disabled:opacity-40 dark:text-emerald-400 dark:hover:bg-emerald-950"><Copy size={15} /></button>
          <button type="button" disabled={disabled} onClick={() => onAction("delete")} aria-label={t.deleteSelected} title={t.deleteSelected} className="rounded p-1.5 text-red-600 hover:bg-red-100 disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-950"><Trash2 size={15} /></button>
        </div>
      </>}
    </div>
  );
}
