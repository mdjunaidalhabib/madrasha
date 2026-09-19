import { toBanglaDigits } from "@madrasha/shared-ui/src/utils/reportUtils";

/** Blue "own grading" chip when the division carries an override fail mark,
 * gray "uses default" chip otherwise. */
export default function DivisionStatusChip({
  failMark,
  className = "",
}: {
  failMark: number | null | undefined;
  className?: string;
}) {
  const own = failMark !== null && failMark !== undefined;
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 ${
        own
          ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
      } ${className}`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${own ? "bg-blue-500" : "bg-slate-400 dark:bg-slate-500"}`}
      />
      <span className="truncate">
        {own ? `নিজস্ব গ্রেডিং · ফেল মার্ক ${toBanglaDigits(failMark as number)}` : "ডিফল্ট ব্যবহার করছে"}
      </span>
    </span>
  );
}
