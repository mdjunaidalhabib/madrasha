import Button from "@madrasha/shared-ui/src/components/ui/Button";
import Input from "@madrasha/shared-ui/src/components/ui/Input";
import { commonText, formatNumber, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { superAdminText } from "./superAdmin.text";

export default function SearchPaginationBar({
  q,
  setQ,
  clear,
  page,
  totalPages,
  total,
  disablePrev,
  disableNext,
  prev,
  next,
}: {
  q: string;
  setQ: (v: string) => void;
  clear: () => void;
  page: number;
  totalPages: number;
  total: number;
  disablePrev: boolean;
  disableNext: boolean;
  prev: () => void;
  next: () => void;
}) {
  const t = useText(superAdminText);
  const c = useText(commonText);
  const lang = useLang();
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex w-full items-center gap-2 lg:max-w-md">
        <div className="min-w-0 flex-1">
          <Input
            placeholder={t.searchByNameSlug}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Button variant="secondary" onClick={clear} className="shrink-0">
          {c.clear}
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm lg:justify-end">
        <span className="text-gray-600 dark:text-slate-400">
          {t.pageOf} <b>{formatNumber(page, lang)}</b> / <b>{formatNumber(totalPages, lang)}</b>
          {total ? (
            <span>
              {" "}
              • {t.totalLabel}: <b>{formatNumber(total, lang)}</b>
            </span>
          ) : null}
        </span>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={disablePrev} onClick={prev}>
            {t.prev}
          </Button>
          <Button variant="secondary" disabled={disableNext} onClick={next}>
            {t.next}
          </Button>
        </div>
      </div>
    </div>
  );
}
