import { useEffect } from "react";
import { createPortal } from "react-dom";
import { localizeDigits, useLang, useText } from "../../i18n";
import { uiText } from "./ui.text";

/** Above this many steps the checklist collapses to the running step only,
 * so the list never needs its own scrollbar. */
const COMPACT_AFTER = 8;

export interface ProgressStep {
  /** Stable key (e.g. "marks", "book-12"). */
  id: string;
  label: string;
}

interface Props {
  open: boolean;
  /** Heading, e.g. "Saving & processing result". */
  title: string;
  /** Ordered list of every step this task will run. */
  steps: ProgressStep[];
  /** Number of steps already finished (0..steps.length). The step at this
   * index is the one currently running. */
  completed: number;
  /** Set when the running step failed - freezes the bar in a red state. */
  failed?: boolean;
}

/** Full-screen, lightly blurred "work in progress" layer for multi-step
 * operations. Shows an exact percentage, finished/remaining step counts and
 * a per-step checklist so a long save never looks frozen. It sits above the
 * page (blocks clicks) but the page behind stays faintly visible. */
export default function ProgressOverlay({ open, title, steps, completed, failed = false }: Props) {
  const t = useText(uiText);
  const lang = useLang();
  const num = (v: number | string) => localizeDigits(v, lang);

  // Lock background scroll while the overlay is up.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const total = Math.max(steps.length, 1);
  const done = Math.min(Math.max(completed, 0), total);
  const percent = Math.round((done / total) * 100);
  const left = total - done;
  const finished = done >= total && !failed;
  const compact = steps.length > COMPACT_AFTER;

  return createPortal(
    <div
      role="alertdialog"
      aria-modal="true"
      aria-busy={!finished}
      aria-label={title}
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-white/45 p-4 backdrop-blur-[3px] dark:bg-slate-950/55"
    >
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          {finished ? (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z" />
              </svg>
            </span>
          ) : failed ? (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400">
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                <path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4Z" />
              </svg>
            </span>
          ) : (
            <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-blue-600 border-t-transparent" />
          )}
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">{title}</h2>
        </div>

        <div className="mt-5">
          <div className="mb-1.5 flex items-baseline justify-between text-sm">
            <span className="font-semibold text-gray-900 dark:text-slate-100">
              {t.progressPercentDone(num(percent))}
            </span>
            <span className="text-gray-500 dark:text-slate-400">
              {finished ? t.progressAllDone : t.progressStepsLeft(num(left))}
            </span>
          </div>
          <div
            className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-slate-700"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div
              className={`h-full rounded-full transition-[width] duration-500 ease-out ${
                failed ? "bg-red-500" : finished ? "bg-emerald-500" : "bg-blue-600"
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-gray-500 dark:text-slate-400">
            {t.progressStepsDone(num(done), num(total))}
          </p>
        </div>

        <ul className="mt-4 space-y-2">
          {steps.map((step, index) => {
            // Long runs (e.g. 200 records) show only the running step -
            // the counter and bar above already carry the overall picture.
            if (compact && index !== Math.min(done, total - 1)) return null;
            const isDone = index < done;
            const isActive = index === done && !finished;
            const isFailed = isActive && failed;
            return (
              <li key={step.id} className="flex items-center gap-2.5 text-sm">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    isDone
                      ? "bg-emerald-500 text-white"
                      : isFailed
                        ? "bg-red-500 text-white"
                        : isActive
                          ? "border-2 border-blue-600 border-t-transparent animate-spin"
                          : "border border-gray-300 dark:border-slate-600"
                  }`}
                >
                  {isDone ? "✓" : isFailed ? "!" : ""}
                </span>
                <span
                  className={
                    isDone
                      ? "text-gray-500 dark:text-slate-400"
                      : isActive
                        ? "font-medium text-gray-900 dark:text-slate-100"
                        : "text-gray-400 dark:text-slate-500"
                  }
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ul>

        {!finished && !failed && (
          <p className="mt-4 text-xs text-gray-500 dark:text-slate-400">{t.progressDoNotClose}</p>
        )}
      </div>
    </div>,
    document.body,
  );
}
