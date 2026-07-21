import { useEffect, useState } from "react";
import { formatReportValue } from "../../utils/reportUtils";

export type PaperSize = "a4" | "a5";
export type Orientation = "portrait" | "landscape";

type ExportColumn<T> = {
  header: string;
  key: keyof T | string;
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
};

const DataExportPrintActions = <T extends Record<string, any>>({
  columns,
  data,
  fileName = "export-data",
  paperSize: controlledPaperSize,
  orientation: controlledOrientation,
  onPaperSizeChange,
  onOrientationChange,
}: Props<T>) => {
  const [internalPaperSize, setInternalPaperSize] = useState<PaperSize>("a4");
  const [internalOrientation, setInternalOrientation] = useState<Orientation>("portrait");
  const paperSize = controlledPaperSize ?? internalPaperSize;
  const orientation = controlledOrientation ?? internalOrientation;

  const updatePaperSize = (value: PaperSize) => {
    if (onPaperSizeChange) onPaperSizeChange(value);
    else setInternalPaperSize(value);
  };

  const updateOrientation = (value: Orientation) => {
    if (onOrientationChange) onOrientationChange(value);
    else setInternalOrientation(value);
  };

  const getPageMargin = (size: PaperSize) => {
    return size === "a5" ? "7mm" : "10mm";
  };

  const applyPreviewSettings = (
    size: PaperSize = paperSize,
    printOrientation: Orientation = orientation,
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
      padding: ${getPageMargin(size)} !important;
    }
  }
`;

    document.head.appendChild(style);
  };

  useEffect(() => {
    applyPreviewSettings(paperSize, orientation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperSize, orientation]);

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
    const exportData = data.map((item) => {
      const row: Record<string, any> = {};

      columns.forEach((col) => {
        const key = String(col.key);
        const value = item[key];
        row[col.header] =
          value === null || value === undefined || value === ""
            ? ""
            : formatReportValue(value, key);
      });

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
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
      <select
        value={paperSize}
        onChange={(e) => updatePaperSize(e.target.value as PaperSize)}
        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100 sm:w-auto"
      >
        <option value="a4">A4</option>
        <option value="a5">A5</option>
      </select>

      <select
        value={orientation}
        onChange={(e) => updateOrientation(e.target.value as Orientation)}
        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100 sm:w-auto"
      >
        <option value="portrait">Portrait</option>
        <option value="landscape">Landscape</option>
      </select>

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

      <button
        type="button"
        onClick={printData}
        className="col-span-2 h-10 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700 sm:col-auto"
      >
        Print / PDF
      </button>
    </div>
  );
};

export default DataExportPrintActions;
