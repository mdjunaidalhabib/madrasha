import { Check, Layers } from "lucide-react";
import type { ExamDivisionRef } from "./examDivisionScope";

interface DivisionScopePickerProps {
  divisions: ExamDivisionRef[];
  /** Selected division ids; empty = সকল বিভাগ. */
  value: number[];
  onChange: (next: number[]) => void;
  disabled?: boolean;
}

const chipBase =
  "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition disabled:opacity-50";
const chipOn = "border-blue-500 bg-blue-600 text-white shadow-sm dark:border-blue-500 dark:bg-blue-600";
const chipOff =
  "border-slate-300 bg-white text-slate-600 hover:border-blue-400 hover:text-blue-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-500";

/** "কোন বিভাগের পরীক্ষা?" - সকল বিভাগ or any subset of the madrasa's divisions.
 * Picking every division individually collapses back to সকল বিভাগ, matching
 * the backend's normalisation. */
export default function DivisionScopePicker({ divisions, value, onChange, disabled }: DivisionScopePickerProps) {
  const isAll = value.length === 0;

  const toggle = (id: number) => {
    const next = value.includes(id) ? value.filter((v) => v !== id) : [...value, id];
    onChange(next.length === divisions.length ? [] : next);
  };

  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
        <Layers size={14} className="text-blue-600" />
        কোন বিভাগের পরীক্ষা?
      </p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="বিভাগ নির্বাচন">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange([])}
          aria-pressed={isAll}
          className={`${chipBase} ${isAll ? chipOn : chipOff}`}
        >
          {isAll && <Check size={12} />}
          সকল বিভাগ
        </button>
        {divisions.map((d) => {
          const on = !isAll && value.includes(d.division_id);
          return (
            <button
              key={d.division_id}
              type="button"
              disabled={disabled}
              onClick={() => toggle(d.division_id)}
              aria-pressed={on}
              className={`${chipBase} ${on ? chipOn : chipOff}`}
            >
              {on && <Check size={12} />}
              {d.division_name_bn}
            </button>
          );
        })}
      </div>
      {!isAll && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          শুধু নির্বাচিত বিভাগের শ্রেণিগুলোর রুটিন, নম্বর ও ফলাফল এই পরীক্ষায় হবে।
        </p>
      )}
    </div>
  );
}
