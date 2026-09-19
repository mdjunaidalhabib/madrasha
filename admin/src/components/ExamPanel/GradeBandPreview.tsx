import { useMemo } from "react";
import { toBanglaDigits } from "@madrasha/shared-ui/src/utils/reportUtils";
import { getGradeRange, type GradeItem } from "./GradeList";
import { withoutFailGrades, type GradeKind } from "./failGrade";

type Segment = {
  key: string;
  kind: "fail" | "grade" | "gap";
  label: string;
  from: number;
  to: number;
  point?: string;
  /** CSS background (grades only). */
  color?: string;
};

/** Total marks on the 0-100 scale, both ends inclusive. */
const SCALE = 101;

/** Green (highest band) -> amber (lowest passing band). White text on every
 * step keeps >= 4.5:1 contrast, and because the colours are solid fills they
 * read the same in light and dark mode. */
const bandColor = (index: number, total: number) => {
  const t = total <= 1 ? 0 : index / (total - 1); // 0 = highest band
  const hue = 145 - t * 105; // 145 (green) -> 40 (amber)
  const light = 30 - t * 2;
  return `hsl(${hue.toFixed(0)} 72% ${light.toFixed(0)}%)`;
};

const range = (s: Segment) => `${toBanglaDigits(s.from)}-${toBanglaDigits(s.to)}`;

/** Horizontal 0-100 bar: red "ফেল" block, then every grade band sized in
 * proportion to its mark range. Gaps in the scale (marks no band covers) are
 * shown hatched so a misconfigured scale is visible at a glance. On very small
 * screens the bar shrinks to a thin strip and the stacked list carries the
 * detail. */
export default function GradeBandPreview({
  grades,
  failMark,
  title,
  kind,
  failLabel = "ফেল",
}: {
  grades: GradeItem[];
  failMark: number;
  title?: string;
  /** When set, legacy fail-named rows (রাসিব / F) are dropped so they never show as a band. */
  kind?: GradeKind;
  /** Label of the automatic red fail block (the fail grade name, e.g. "রাসিব"). */
  failLabel?: string;
}) {
  const segments = useMemo(() => {
    const bands = (kind ? withoutFailGrades(kind, grades) : grades)
      .map((g) => {
        const { min, max } = getGradeRange(g);
        return { g, min: Number(min), max: Number(max) };
      })
      .filter((b) => Number.isFinite(b.min) && Number.isFinite(b.max))
      .sort((a, b) => a.min - b.min);

    // Fail is strictly below the fail mark (0..failMark-1); pass starts AT it.
    const failTo = Math.max(0, Math.min(100, failMark)) - 1;
    const list: Segment[] =
      failTo >= 0 ? [{ key: "fail", kind: "fail", label: failLabel, from: 0, to: failTo }] : [];
    let cursor = failTo + 1;
    // Rank 0 = highest band, for the colour ramp.
    const total = bands.length;

    bands.forEach((b, i) => {
      if (b.min > cursor) {
        list.push({ key: `gap-${cursor}`, kind: "gap", label: "গ্রেডহীন", from: cursor, to: b.min - 1 });
      }
      const point = b.g.point !== undefined && b.g.point !== null && b.g.point !== "" ? String(b.g.point) : undefined;
      list.push({
        key: `g-${b.g.id}`,
        kind: "grade",
        label: b.g.name,
        from: b.min,
        to: b.max,
        point,
        color: bandColor(total - 1 - i, total),
      });
      cursor = Math.max(cursor, b.max + 1);
    });

    if (cursor <= 100) {
      list.push({ key: `gap-${cursor}`, kind: "gap", label: "গ্রেডহীন", from: cursor, to: 100 });
    }
    return list;
  }, [grades, failMark, kind, failLabel]);

  const widthOf = (s: Segment) => ((s.to - s.from + 1) / SCALE) * 100;
  const hasGap = segments.some((s) => s.kind === "gap");

  return (
    <section
      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5"
      aria-label={title ?? "গ্রেড স্কেল প্রিভিউ"}
    >
      {title && <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{title}</h3>}

      <div>
        <div className="flex h-4 w-full gap-px overflow-hidden rounded-lg bg-white dark:bg-slate-900 sm:h-12" role="img" aria-label={segments.map((s) => `${s.label} ${range(s)}`).join(", ")}>
          {segments.map((s) => {
            const pct = widthOf(s);
            return (
              <div
                key={s.key}
                title={`${s.label}: ${range(s)}${s.point ? ` · পয়েন্ট ${toBanglaDigits(s.point)}` : ""}`}
                style={{ width: `${pct}%`, ...(s.kind === "grade" ? { backgroundColor: s.color } : {}) }}
                className={`flex min-w-0 flex-col items-center justify-center overflow-hidden px-0.5 text-center text-white ${
                  s.kind === "fail"
                    ? "bg-rose-600 dark:bg-rose-700"
                    : s.kind === "gap"
                      ? "bg-[repeating-linear-gradient(135deg,#cbd5e1_0_4px,#e2e8f0_4px_8px)] text-slate-600 dark:bg-[repeating-linear-gradient(135deg,#334155_0_4px,#1e293b_4px_8px)] dark:text-slate-300"
                      : ""
                }`}
              >
                {pct >= 6 && <span className="hidden max-w-full truncate text-xs font-bold leading-4 sm:block">{s.label}</span>}
                {pct >= 12 && (
                  <span className="hidden max-w-full truncate text-[10px] leading-3 opacity-90 sm:block">{range(s)}</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex justify-between text-[10px] font-medium text-slate-400 dark:text-slate-500">
          <span>{toBanglaDigits(0)}</span>
          <span>{toBanglaDigits(100)}</span>
        </div>
      </div>

      <ul className="grid grid-cols-1 gap-1.5 text-xs sm:flex sm:flex-wrap sm:gap-x-4 sm:gap-y-1.5">
        {[...segments].reverse().map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <span
              aria-hidden="true"
              className={`h-3 w-3 shrink-0 rounded-sm ${
                s.kind === "fail" ? "bg-rose-600" : s.kind === "gap" ? "bg-slate-300 dark:bg-slate-600" : ""
              }`}
              style={s.kind === "grade" ? { backgroundColor: s.color } : undefined}
            />
            <span className="font-semibold">{s.label}</span>
            <span className="tabular-nums text-slate-500 dark:text-slate-400">{range(s)}</span>
            {s.point && <span className="text-slate-500 dark:text-slate-400">· পয়েন্ট {toBanglaDigits(s.point)}</span>}
          </li>
        ))}
      </ul>

      {hasGap && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          কিছু নম্বর কোনো গ্রেডের আওতায় পড়ছে না (হ্যাচ করা অংশ) — গ্রেডগুলো ঠিক করুন।
        </p>
      )}
    </section>
  );
}
