import { useEffect, useState } from "react";
import { localizeDigits, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { studentsText } from "../students.text";

export function usePeoplePagination(total: number, filterKey: string) {
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  useEffect(() => setPage(1), [filterKey, pageSize]);
  useEffect(() => setPage((value) => Math.min(value, totalPages)), [totalPages]);
  const start = (currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  return { total, pageSize, setPageSize, currentPage, setPage, totalPages, start, end };
}

export default function PeoplePagination({ pagination }: { pagination: ReturnType<typeof usePeoplePagination> }) {
  const t = useText(studentsText);
  const lang = useLang();
  const digits = (value: number) => localizeDigits(value, lang);
  const { total, pageSize, setPageSize, currentPage, setPage, totalPages, start, end } = pagination;
  const buttonClass = "h-6 rounded-md border border-gray-300 px-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";

  return (
    <div className="mt-auto flex flex-col items-center justify-between gap-2 rounded-lg bg-white px-3 py-1.5 shadow-sm dark:bg-slate-900 sm:flex-row">
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-gray-500 dark:text-slate-400">
        <span>{t.showing(digits(total ? start + 1 : 0), digits(end), digits(total))}</span>
        <select
          value={pageSize}
          onChange={(event) => setPageSize(Number(event.target.value))}
          aria-label={t.perPage(digits(pageSize))}
          className="h-6 rounded-md border border-gray-300 px-1.5 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        >
          {[20, 50, 100].map((size) => <option key={size} value={size}>{t.perPage(digits(size))}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-1.5">
        <button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} className={buttonClass}>{t.prevPage}</button>
        <span className="text-xs text-gray-600 dark:text-slate-400">{t.pageOf(digits(currentPage), digits(totalPages))}</span>
        <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)} className={buttonClass}>{t.nextPage}</button>
      </div>
    </div>
  );
}
