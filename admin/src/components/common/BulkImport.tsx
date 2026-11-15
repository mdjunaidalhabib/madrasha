import { useEffect, useId, useRef, type ReactNode } from "react";
import { Download, Loader2, X } from "lucide-react";
import { commonText, localizeDigits, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import ExcelUpload from "./ExcelUpload";

interface BulkImportModalProps {
  title: string;
  subtitle: string;
  compact: boolean;
  loading: boolean;
  onClose: () => void;
  onSubmit?: () => void;
  submitLabel?: string;
  completed?: boolean;
  children: ReactNode;
}

export function BulkImportModal({
  title,
  subtitle,
  compact,
  loading,
  onClose,
  onSubmit,
  submitLabel,
  completed = false,
  children,
}: BulkImportModalProps) {
  const c = useText(commonText);
  const titleId = useId();
  const subtitleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3 sm:px-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitleId}
        aria-busy={loading}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            if (!loading) onClose();
          }
          if (event.key !== "Tab") return;
          const controls = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
            ),
          ).filter((element) => element.getClientRects().length > 0);
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (!first) {
            event.preventDefault();
          } else if (
            event.shiftKey &&
            (document.activeElement === first || document.activeElement === panelRef.current)
          ) {
            event.preventDefault();
            last.focus();
          } else if (
            !event.shiftKey &&
            (document.activeElement === last || document.activeElement === panelRef.current)
          ) {
            event.preventDefault();
            first.focus();
          }
        }}
        className={`flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl outline-none transition-[max-width] dark:bg-slate-900 sm:max-h-[90vh] ${compact ? "max-w-lg" : "max-w-7xl"}`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3 dark:border-slate-700 sm:px-5 sm:py-3.5">
          <div>
            <h2
              id={titleId}
              className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg"
            >
              {title}
            </h2>
            <p id={subtitleId} className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label={c.close}
            title={c.close}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-600 bg-red-600 text-white shadow-sm transition hover:border-red-700 hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
        {(completed || onSubmit) && (
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:justify-end sm:px-5">
            {completed && (
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-lg border border-red-600 bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition hover:border-red-700 hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {c.close}
              </button>
            )}
            {!completed && onSubmit && (
              <button
                type="button"
                onClick={onSubmit}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {submitLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface BulkImportUploadStepsProps<T> {
  templateLabel: string;
  uploadLabel: string;
  hints: string[];
  downloadLabel: string;
  buttonText: string;
  loading: boolean;
  requiredColumns: string[];
  onDownloadTemplate: () => void;
  onDataUpload: (data: T[]) => void;
}

export function BulkImportUploadSteps<T>({
  templateLabel,
  uploadLabel,
  hints,
  downloadLabel,
  buttonText,
  loading,
  requiredColumns,
  onDownloadTemplate,
  onDataUpload,
}: BulkImportUploadStepsProps<T>) {
  const lang = useLang();
  return (
    <ol className="space-y-5">
      <li className="flex gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
          {localizeDigits(1, lang)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-800 dark:text-slate-100">{templateLabel}</p>
          <ul className="mt-1 list-disc space-y-0.5 ps-4 text-xs text-slate-500 dark:text-slate-400">
            {hints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onDownloadTemplate}
            disabled={loading}
            className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-600 px-3.5 py-1.5 text-sm text-emerald-700 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 dark:border-emerald-500 dark:text-emerald-400 dark:hover:bg-emerald-950/40 sm:w-auto"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {downloadLabel}
          </button>
        </div>
      </li>
      <li className="flex gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs text-blue-700 dark:bg-blue-950/50 dark:text-blue-400">
          {localizeDigits(2, lang)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="mb-2 text-sm text-slate-800 dark:text-slate-100">{uploadLabel}</p>
          <ExcelUpload<T>
            compact
            buttonText={buttonText}
            onDataUpload={onDataUpload}
            disabled={loading}
            requiredColumns={requiredColumns}
          />
        </div>
      </li>
    </ol>
  );
}

export function BulkImportPreview({
  title,
  subtitle,
  clearLabel,
  loading,
  onClear,
  children,
}: {
  title: string;
  subtitle: string;
  clearLabel: string;
  loading: boolean;
  onClear: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">
            {title}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={loading}
          className="w-full rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40 sm:w-auto"
        >
          {clearLabel}
        </button>
      </div>
      {children}
    </div>
  );
}

export interface BulkImportColumn<T> {
  key: string;
  label: string;
  render: (row: T, index: number) => ReactNode;
  emphasis?: boolean;
}

function BulkImportTable<T>({
  rows,
  columns,
  wide = false,
}: {
  rows: T[];
  columns: BulkImportColumn<T>[];
  wide?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="max-h-[55dvh] overflow-auto sm:max-h-[420px]">
        <table
          className="w-full text-xs sm:text-sm"
          style={{ minWidth: wide ? Math.max(560, columns.length * 80) : 560 }}
        >
          <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="whitespace-nowrap border-b px-2.5 py-2 text-start font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300 sm:px-3 sm:py-3"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={index}
                className="border-b transition last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3 ${column.emphasis ? "font-semibold text-slate-900 dark:text-slate-100" : ""}`}
                  >
                    {column.render(row, index)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function BulkImportStatus({ updated, children }: { updated: boolean; children: ReactNode }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${updated ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"}`}
    >
      {children}
    </span>
  );
}

interface BulkImportWizardProps<T, R> {
  open: boolean;
  loading: boolean;
  title: string;
  subtitle: string;
  rows: T[];
  columns: BulkImportColumn<T>[];
  previewTitle: string;
  previewSubtitle: string;
  clearLabel: string;
  submitLabel: string;
  upload: Omit<BulkImportUploadStepsProps<T>, "loading" | "onDataUpload" | "onDownloadTemplate">;
  result: null | {
    title: string;
    inserted: number;
    updated: number;
    insertedLabel: string;
    updatedLabel: string;
    notice?: string;
    uploadAnotherLabel: string;
    rows: R[];
    columns: BulkImportColumn<R>[];
  };
  onClose: () => void;
  onClear: () => void;
  onSubmit: () => void;
  onDataUpload: (rows: T[]) => void;
  onDownloadTemplate: () => void;
}

/** All bulk imports share the entire upload, preview and completion UI. */
export function BulkImportWizard<T, R>({
  open,
  loading,
  title,
  subtitle,
  rows,
  columns,
  previewTitle,
  previewSubtitle,
  clearLabel,
  submitLabel,
  upload,
  result,
  onClose,
  onClear,
  onSubmit,
  onDataUpload,
  onDownloadTemplate,
}: BulkImportWizardProps<T, R>) {
  const lang = useLang();
  if (!open) return null;
  return (
    <BulkImportModal
      title={title}
      subtitle={subtitle}
      compact={!result && rows.length === 0}
      loading={loading}
      onClose={onClose}
      completed={Boolean(result)}
      onSubmit={!result && rows.length > 0 ? onSubmit : undefined}
      submitLabel={submitLabel}
    >
      {result ? (
        <div>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">
                {result.title}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {result.insertedLabel}{" "}
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {localizeDigits(result.inserted, lang)}
                </span>
                {" | "}
                {result.updatedLabel}{" "}
                <span className="font-semibold text-amber-700 dark:text-amber-400">
                  {localizeDigits(result.updated, lang)}
                </span>
              </p>
              {result.notice && (
                <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">{result.notice}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClear}
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
            >
              {result.uploadAnotherLabel}
            </button>
          </div>
          <BulkImportTable rows={result.rows} columns={result.columns} />
        </div>
      ) : rows.length === 0 ? (
        <BulkImportUploadSteps
          {...upload}
          loading={loading}
          onDataUpload={onDataUpload}
          onDownloadTemplate={onDownloadTemplate}
        />
      ) : (
        <BulkImportPreview
          title={previewTitle}
          subtitle={previewSubtitle}
          clearLabel={clearLabel}
          loading={loading}
          onClear={onClear}
        >
          <BulkImportTable rows={rows} columns={columns} wide />
        </BulkImportPreview>
      )}
    </BulkImportModal>
  );
}
