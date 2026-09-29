import { useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { getText, useText } from "@madrasha/shared-ui/src/i18n";
import { commonUiText } from "./commonUi.text";

interface ExcelUploadProps<T> {
  onDataUpload: (data: T[]) => void;
  buttonText?: string;
  disabled?: boolean;
  requiredColumns?: string[];
  /** Slim single dropzone (no outer card / big icon) for tight modals. */
  compact?: boolean;
}

const ExcelUpload = <T,>({
  onDataUpload,
  buttonText,
  disabled = false,
  requiredColumns = [],
  compact = false,
}: ExcelUploadProps<T>) => {
  const t = useText(commonUiText);
  const [dragging, setDragging] = useState(false);
  const cleanHeaderKey = (key: string) => key.replace("*", "").trim();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const processFile = (file: File) => {
    const isValidFile =
      file.name.endsWith(".xlsx") || file.name.endsWith(".xls") || file.name.endsWith(".csv");

    if (!isValidFile) {
      useToastStore.getState().show("Only .xlsx, .xls, or .csv file allowed", "error");
      return;
    }

    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const XLSX = await import("xlsx");
        const result = event.target?.result;
        if (!result) return useToastStore.getState().show(getText(commonUiText).fileReadFailed, "error");

        const data = new Uint8Array(result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        const sheetName = workbook.SheetNames[0];
        if (!sheetName) return useToastStore.getState().show(getText(commonUiText).sheetNotFound, "error");

        const sheet = workbook.Sheets[sheetName];

        const allRows = XLSX.utils.sheet_to_json<any[]>(sheet, {
          header: 1,
          defval: "",
          raw: false,
        });

        if (!allRows.length) return useToastStore.getState().show(getText(commonUiText).excelEmpty, "error");

        const headerRowIndex = allRows.findIndex((row) =>
          row.some((cell) => requiredColumns.includes(cleanHeaderKey(String(cell)))),
        );

        if (headerRowIndex === -1) {
          useToastStore.getState().show("Required columns not found in Excel template", "error");
          return;
        }

        const headers = allRows[headerRowIndex].map((header) => cleanHeaderKey(String(header)));

        const cleanedRows = allRows
          .slice(headerRowIndex + 1)
          .filter((row) => row.some((cell) => String(cell).trim() !== ""))
          .map((row) => {
            const item: Record<string, any> = {};

            headers.forEach((header, index) => {
              if (header) item[header] = row[index] ?? "";
            });

            return item;
          }) as T[];

        if (!cleanedRows.length) return useToastStore.getState().show(getText(commonUiText).noStudentData, "error");

        onDataUpload(cleanedRows);
      } catch (error) {
        logger.error("EXCEL UPLOAD ERROR:", error);
        useToastStore.getState().show("Invalid Excel file", "error");
      }
    };

    reader.onerror = () => useToastStore.getState().show(getText(commonUiText).fileReadFailed, "error");

    reader.readAsArrayBuffer(file);
  };

  if (compact) {
    return (
      <div>
        <label
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
            dragging
              ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
              : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-blue-500"
          } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
        >
          <FileSpreadsheet className="h-8 w-8 text-blue-600 dark:text-blue-400" strokeWidth={1.5} />
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-normal text-white shadow-sm transition hover:bg-blue-700">
            <Upload className="h-4 w-4" />
            {buttonText ?? t.uploadExcel}
          </span>
          <span className="hidden text-xs text-slate-500 dark:text-slate-400 sm:inline">{t.orDropHere}</span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">{t.supportedFiles}</span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            disabled={disabled}
            className="hidden"
          />
        </label>

        {requiredColumns.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400">{t.requiredColumns}:</span>
            {requiredColumns.map((column) => (
              <span
                key={column}
                className="rounded-md bg-red-50 px-2 py-0.5 font-mono text-[11px] text-red-700 dark:bg-red-950/40 dark:text-red-400"
              >
                {column}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-blue-50/40 p-8 text-center transition hover:border-blue-500 hover:shadow-md dark:border-slate-700 dark:from-slate-800 dark:to-slate-800/40">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-3xl text-white shadow-sm">
          📄
        </div>

        <h3 className="mb-1 text-lg font-bold text-slate-900 dark:text-slate-100">{t.uploadExcel}</h3>

        <p className="mx-auto mb-6 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
          {t.excelHintBefore}{" "}
          <span className="font-bold text-red-600 dark:text-red-400">*</span> {t.excelHintAfter}
        </p>

        <label
          className={`inline-block ${
            disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
          }`}
        >
          <span className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700">
            {buttonText ?? t.uploadExcel}
          </span>

          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            disabled={disabled}
            className="hidden"
          />
        </label>

        <p className="mt-4 text-xs font-medium text-slate-500 dark:text-slate-400">{t.supportedFiles}</p>
      </div>

      {requiredColumns.length > 0 && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/40">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-red-900 dark:text-red-400">{t.requiredColumns}</h4>
              <p className="text-xs text-red-700 dark:text-red-400">
                {t.requiredColumnsHint}
              </p>
            </div>

            <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
              {t.required}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {requiredColumns.map((column) => (
              <span
                key={column}
                className="rounded-full border border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-700 dark:border-red-800 dark:bg-slate-900 dark:text-red-400"
              >
                * {column}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExcelUpload;
