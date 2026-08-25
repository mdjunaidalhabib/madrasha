import { useEffect, useRef, useState } from "react";
import { formatReportValue } from "../../utils/reportUtils";

export type PaperSize = "a4" | "a5";
export type Orientation = "portrait" | "landscape";
export type PageMargins = { top: number; right: number; bottom: number; left: number };
type MarginSide = keyof PageMargins;

type ExportColumn<T> = {
  header: string;
  key: keyof T | string;
};

const MIN_MARGIN_MM = 0;
const MAX_MARGIN_MM = 40;

const getDefaultMargins = (size: PaperSize): PageMargins => {
  const value = size === "a5" ? 7 : 10;
  return { top: value, right: value, bottom: value, left: value };
};

const MARGIN_SIDE_LABELS: Record<MarginSide, string> = {
  top: "উপর",
  right: "ডান",
  bottom: "নিচ",
  left: "বাম",
};

type Props<T> = {
  title: string;
  columns: ExportColumn<T>[];
  data: T[];
  fileName?: string;
  paperSize?: PaperSize;
  orientation?: Orientation;
  onPaperSizeChange?: (value: PaperSize) => void;
  onOrientationChange?: (value: Orientation) => void;
  /** পেজের চার পাশের মার্জিন (mm), প্রতিটা পাশ আলাদাভাবে সেট করা যায় - না দিলে
   * paperSize অনুযায়ী ডিফল্ট (a5=7mm, a4=10mm, চার পাশে সমান) ব্যবহৃত হয়। */
  margins?: PageMargins;
  onMarginsChange?: (value: PageMargins) => void;
  /** A4/A5, Portrait/Landscape ও প্রিন্ট বাটন লুকিয়ে শুধু Excel/CSV এক্সপোর্ট দেখাতে চাইলে true। */
  hidePrintOptions?: boolean;
};

const DataExportPrintActions = <T extends Record<string, any>>({
  columns,
  data,
  fileName = "export-data",
  paperSize: controlledPaperSize,
  orientation: controlledOrientation,
  onPaperSizeChange,
  onOrientationChange,
  margins: controlledMargins,
  onMarginsChange,
  hidePrintOptions = false,
}: Props<T>) => {
  const [internalPaperSize, setInternalPaperSize] = useState<PaperSize>("a4");
  const [internalOrientation, setInternalOrientation] = useState<Orientation>("portrait");
  const [internalMargins, setInternalMargins] = useState<PageMargins>(getDefaultMargins("a4"));
  const [marginPanelOpen, setMarginPanelOpen] = useState(false);
  const marginPanelRef = useRef<HTMLDivElement>(null);
  const paperSize = controlledPaperSize ?? internalPaperSize;
  const orientation = controlledOrientation ?? internalOrientation;
  const margins = controlledMargins ?? internalMargins;

  const updatePaperSize = (value: PaperSize) => {
    if (onPaperSizeChange) onPaperSizeChange(value);
    else setInternalPaperSize(value);
    // margins এর নিজস্ব state ownership থাকলে (parent থেকে controlled) সেই
    // parent-ই paperSize বদলানোয় ডিফল্ট মার্জিন রিসেট করার দায়িত্ব নেয় (দ্র.
    // ReportShell) - এখানে শুধু uncontrolled ব্যবহারের জন্য রিসেট করা হয়।
    if (controlledMargins === undefined) setInternalMargins(getDefaultMargins(value));
  };

  const updateOrientation = (value: Orientation) => {
    if (onOrientationChange) onOrientationChange(value);
    else setInternalOrientation(value);
  };

  const updateMarginSide = (side: MarginSide, value: number) => {
    if (Number.isNaN(value)) return;
    const clamped = Math.min(MAX_MARGIN_MM, Math.max(MIN_MARGIN_MM, Math.round(value)));
    const next = { ...margins, [side]: clamped };
    if (onMarginsChange) onMarginsChange(next);
    else setInternalMargins(next);
  };

  const resetMarginsToDefault = () => {
    const defaults = getDefaultMargins(paperSize);
    if (onMarginsChange) onMarginsChange(defaults);
    else setInternalMargins(defaults);
  };

  useEffect(() => {
    if (!marginPanelOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (marginPanelRef.current && !marginPanelRef.current.contains(event.target as Node)) {
        setMarginPanelOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [marginPanelOpen]);

  const applyPreviewSettings = (
    size: PaperSize = paperSize,
    printOrientation: Orientation = orientation,
    pageMargins: PageMargins = margins,
  ) => {
    document.documentElement.setAttribute("data-print-size", size);
    document.documentElement.setAttribute("data-print-orientation", printOrientation);

    const styleId = "dynamic-print-page-size";
    document.getElementById(styleId)?.remove();

    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
  @page {
    size: ${size.toUpperCase()} ${printOrientation};
    margin: 0;
  }

  @media print {
    .print-page-preview {
      padding: ${pageMargins.top}mm ${pageMargins.right}mm ${pageMargins.bottom}mm ${pageMargins.left}mm !important;
    }
  }
`;

    document.head.appendChild(style);
  };

  useEffect(() => {
    applyPreviewSettings(paperSize, orientation, margins);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperSize, orientation, margins.top, margins.right, margins.bottom, margins.left]);

  const getRows = () =>
    data.map((item) =>
      columns.map((col) => {
        const key = String(col.key);
        const value = item[key];
        return value === null || value === undefined || value === ""
          ? ""
          : formatReportValue(value, key);
      }),
    );

  const downloadCSV = () => {
    const csvContent = [columns.map((col) => col.header), ...getRows()]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${fileName}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  };

  const downloadExcel = async () => {
    const XLSX = await import("xlsx");

    const headerRow = columns.map((col) => col.header);
    const bodyRows = getRows();
    const worksheet = XLSX.utils.aoa_to_sheet([headerRow, ...bodyRows]);

    // হেডার সারি বোল্ড + নীল ব্যাকগ্রাউন্ড এবং সব সেলে হালকা বর্ডার — এক্সেলে
    // খুললে সারি-কলাম এলোমেলো না লেগে সাজানো টেবিলের মতো দেখায়।
    const thinBorder = { style: "thin", color: { rgb: "CBD5E1" } } as const;
    const cellBorder = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

    headerRow.forEach((_, colIndex) => {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIndex });
      if (!worksheet[cellRef]) return;
      worksheet[cellRef].s = {
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
        fill: { patternType: "solid", fgColor: { rgb: "1E40AF" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: cellBorder,
      };
    });

    bodyRows.forEach((row, rowIndex) => {
      row.forEach((_, colIndex) => {
        const cellRef = XLSX.utils.encode_cell({ r: rowIndex + 1, c: colIndex });
        if (!worksheet[cellRef]) return;
        worksheet[cellRef].s = {
          alignment: { horizontal: "center", vertical: "center" },
          border: cellBorder,
        };
      });
    });

    // কলামের প্রশস্ততা সেই কলামের সবচেয়ে লম্বা মান অনুযায়ী — নাহলে লেখা কাটা
    // পড়ে বা পাশের কলামের সাথে মিশে যায়।
    worksheet["!cols"] = headerRow.map((header, colIndex) => {
      const maxLen = bodyRows.reduce(
        (max, row) => Math.max(max, String(row[colIndex] ?? "").length),
        header.length,
      );
      return { wch: Math.min(Math.max(maxLen + 2, 12), 40) };
    });

    worksheet["!rows"] = [{ hpt: 22 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  };

  const printData = () => {
    applyPreviewSettings(paperSize, orientation);

    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
      {!hidePrintOptions && (
        <>
          <select
            value={paperSize}
            onChange={(e) => updatePaperSize(e.target.value as PaperSize)}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-auto"
          >
            <option value="a4">A4</option>
            <option value="a5">A5</option>
          </select>

          <select
            value={orientation}
            onChange={(e) => updateOrientation(e.target.value as Orientation)}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-auto"
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>

          <div ref={marginPanelRef} className="relative w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setMarginPanelOpen((open) => !open)}
              title="মার্জিন - পেজের চার পাশের ফাঁকা জায়গা আলাদাভাবে কম-বেশি করুন"
              className="flex h-10 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-auto"
            >
              মার্জিন
            </button>

            {marginPanelOpen && (
              <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-700">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    পেজ মার্জিন (mm)
                  </span>
                  <button
                    type="button"
                    onClick={resetMarginsToDefault}
                    className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    ডিফল্ট সেট
                  </button>
                </div>

                <div className="flex flex-col gap-2.5 p-3">
                  {(["top", "right", "bottom", "left"] as MarginSide[]).map((side) => (
                    <div key={side} className="flex items-center justify-between">
                      <span className="w-9 text-xs text-slate-500 dark:text-slate-400">
                        {MARGIN_SIDE_LABELS[side]}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateMarginSide(side, margins[side] - 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={MIN_MARGIN_MM}
                          max={MAX_MARGIN_MM}
                          value={margins[side]}
                          onChange={(e) => updateMarginSide(side, Number(e.target.value))}
                          className="w-10 rounded-md border border-slate-200 bg-white py-1 text-center text-xs outline-none focus:border-blue-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        />
                        <button
                          type="button"
                          onClick={() => updateMarginSide(side, margins[side] + 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          +
                        </button>
                        <span className="w-5 text-left text-[10px] text-slate-400 dark:text-slate-500">
                          mm
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <button
        type="button"
        onClick={downloadExcel}
        className="h-10 rounded-lg bg-green-600 px-4 py-2 font-semibold text-white transition hover:bg-green-700"
      >
        Excel
      </button>

      <button
        type="button"
        onClick={downloadCSV}
        className="h-10 rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white transition hover:bg-purple-700"
      >
        CSV
      </button>

      {!hidePrintOptions && (
        <button
          type="button"
          onClick={printData}
          className="col-span-2 h-10 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700 sm:col-auto"
        >
          Print / PDF
        </button>
      )}
    </div>
  );
};

export default DataExportPrintActions;
