import { logger } from "../../utils/logger";
import { useToastStore } from "../../store/toastStore";

interface ExcelUploadProps<T> {
  onDataUpload: (data: T[]) => void;
  buttonText?: string;
  disabled?: boolean;
  requiredColumns?: string[];
}

const ExcelUpload = <T,>({
  onDataUpload,
  buttonText = "Upload Excel File",
  disabled = false,
  requiredColumns = [],
}: ExcelUploadProps<T>) => {
  const cleanHeaderKey = (key: string) => key.replace("*", "").trim();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isValidFile =
      file.name.endsWith(".xlsx") || file.name.endsWith(".xls") || file.name.endsWith(".csv");

    if (!isValidFile) {
      useToastStore.getState().show("Only .xlsx, .xls, or .csv file allowed", "error");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const XLSX = await import("xlsx");
        const result = event.target?.result;
        if (!result) return useToastStore.getState().show("File read failed", "error");

        const data = new Uint8Array(result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        const sheetName = workbook.SheetNames[0];
        if (!sheetName) return useToastStore.getState().show("Excel sheet not found", "error");

        const sheet = workbook.Sheets[sheetName];

        const allRows = XLSX.utils.sheet_to_json<any[]>(sheet, {
          header: 1,
          defval: "",
          raw: false,
        });

        if (!allRows.length) return useToastStore.getState().show("Excel file is empty", "error");

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

        if (!cleanedRows.length) return useToastStore.getState().show("No student data found", "error");

        onDataUpload(cleanedRows);
        e.target.value = "";
      } catch (error) {
        logger.error("EXCEL UPLOAD ERROR:", error);
        useToastStore.getState().show("Invalid Excel file", "error");
      }
    };

    reader.onerror = () => useToastStore.getState().show("Failed to read file", "error");

    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-blue-50/40 p-8 text-center transition hover:border-blue-500 hover:shadow-md">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-3xl text-white shadow-sm">
          📄
        </div>

        <h3 className="mb-1 text-lg font-bold text-slate-900">Upload Excel File</h3>

        <p className="mx-auto mb-6 max-w-md text-sm leading-6 text-slate-500">
          Select admission Excel file. Required columns marked with{" "}
          <span className="font-bold text-red-600">*</span> will be detected automatically.
        </p>

        <label
          className={`inline-block ${
            disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
          }`}
        >
          <span className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700">
            {buttonText}
          </span>

          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            disabled={disabled}
            className="hidden"
          />
        </label>

        <p className="mt-4 text-xs font-medium text-slate-500">Supported file: .xlsx, .xls, .csv</p>
      </div>

      {requiredColumns.length > 0 && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-red-900">Required Template Columns</h4>
              <p className="text-xs text-red-700">
                Template-এ এই columns red color এবং * mark থাকবে
              </p>
            </div>

            <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
              Required
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {requiredColumns.map((column) => (
              <span
                key={column}
                className="rounded-full border border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-700"
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
