import { useEffect, useState } from "react";
import * as XLSX from "xlsx";

type PaperSize = "a4" | "a5";
type Orientation = "portrait" | "landscape";

type ExportColumn<T> = {
  header: string;
  key: keyof T | string;
};

type Props<T> = {
  title: string;
  columns: ExportColumn<T>[];
  data: T[];
  fileName?: string;
};

const DataExportPrintActions = <T extends Record<string, any>>({
  columns,
  data,
  fileName = "export-data",
}: Props<T>) => {
  const [paperSize, setPaperSize] = useState<PaperSize>("a4");
  const [orientation, setOrientation] = useState<Orientation>("portrait");

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

  const getRows = () => data.map((item) => columns.map((col) => item[col.key as string] ?? ""));

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

  const downloadExcel = () => {
    const exportData = data.map((item) => {
      const row: Record<string, any> = {};

      columns.forEach((col) => {
        row[col.header] = item[col.key as string] ?? "";
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
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={paperSize}
        onChange={(e) => setPaperSize(e.target.value as PaperSize)}
        className="rounded border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="a4">A4</option>
        <option value="a5">A5</option>
      </select>

      <select
        value={orientation}
        onChange={(e) => setOrientation(e.target.value as Orientation)}
        className="rounded border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="portrait">Portrait</option>
        <option value="landscape">Landscape</option>
      </select>

      <button
        type="button"
        onClick={downloadExcel}
        className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
      >
        Excel
      </button>

      <button
        type="button"
        onClick={downloadCSV}
        className="rounded bg-purple-600 px-4 py-2 text-white hover:bg-purple-700"
      >
        CSV
      </button>

      <button
        type="button"
        onClick={printData}
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Print / PDF
      </button>
    </div>
  );
};

export default DataExportPrintActions;
