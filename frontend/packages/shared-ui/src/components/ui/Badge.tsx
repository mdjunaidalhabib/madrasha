import { ReactNode } from "react";

export type BadgeTone = "green" | "yellow" | "red" | "blue" | "purple" | "slate";

const TONE_CLASSES: Record<BadgeTone, string> = {
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  yellow: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  red: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  purple: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400",
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export default function Badge({
  children,
  tone = "slate",
  className = "",
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
