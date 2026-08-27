import { useEffect, useRef, useState } from "react";
import { FileDown, FileSpreadsheet, FileText, Printer, Ruler, X } from "lucide-react";
import api from "../../services/api";
import { formatReportValue } from "../../utils/reportUtils";
import { useToastStore } from "../../store/toastStore";
import { logger } from "../../utils/logger";

// CSS px per mm at 96 DPI (same constant as Report/pagination/pageGeometry's
// MM_TO_CSS_PX - kept local here rather than importing across the
// common/Report module boundary for one stable, unchanging conversion).
const MM_TO_CSS_PX = 96 / 25.4;

const selectFieldClass =
  "h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-[13px] text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:ring-blue-900/40 sm:w-auto";

export type PaperSize = "a4" | "a5";
export type Orientation = "portrait" | "landscape";
export type PageMargins = { top: number; right: number; bottom: number; left: number };
type MarginSide = keyof PageMargins;

// A4/A5 physical page size in mm (portrait) - swapped for landscape below.
const PAPER_SIZE_MM: Record<PaperSize, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  a5: { width: 148, height: 210 },
};

type ExportColumn<T> = {
  header: string;
  key: keyof T | string;
};

/** যখন এটা দেওয়া থাকে, "PDF" বাটন client-side html2canvas-এর বদলে backend-এর
 * headless-browser এক্সপোর্ট এন্ডপয়েন্ট (`POST /reports/export-pdf`) কল করে -
 * জটিল বাংলা স্ক্রিপ্ট সঠিকভাবে রেন্ডার করতে ব্রাউজারের নিজস্ব রেন্ডারার
 * ব্যবহার করে, `html2canvas`-এর ক্যানভাস-টেক্সট-পেইন্টার দিয়ে না (দ্র.
 * backend/src/modules/reports/controllers/report-export.service.ts)। না
 * দিলে (এই কম্পোনেন্টের অন্য caller-দের জন্য, যেমন TeacherListPage) আগের
 * client-side পাথই চলে - কিছু ভাঙে না। */
export type ServerPdfExportConfig = {
  reportsPage: string;
  reportKey: string;
  filters: Record<string, string | undefined>;
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
  serverPdfExport?: ServerPdfExportConfig;
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
  serverPdfExport,
}: Props<T>) => {
  const [internalPaperSize, setInternalPaperSize] = useState<PaperSize>("a4");
  const [internalOrientation, setInternalOrientation] = useState<Orientation>("portrait");
  const [internalMargins, setInternalMargins] = useState<PageMargins>(getDefaultMargins("a4"));
  const [marginPanelOpen, setMarginPanelOpen] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ current: number; total: number } | null>(null);
  const marginPanelRef = useRef<HTMLDivElement>(null);
  const pdfCancelRef = useRef(false);
  const pdfAbortControllerRef = useRef<AbortController | null>(null);
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

  // Captures the already-rendered preview pages (the exact same
  // .print-page-preview sections `window.print()` uses) to canvas and embeds
  // them into a PDF - a direct file download, no browser print dialog.
  //
  // The on-screen preview is normally shrunk to fit the viewport via a CSS
  // `zoom` on .print-pages (see PaginatedReportPreview's previewScale/
  // ResizeObserver). An earlier version of this function reset that zoom to
  // 1 before capturing - but `zoom` is a DOM style React itself owns
  // (PaginatedReportPreview sets it every render from `previewScale` state),
  // so a raw `element.style.setProperty` fought with React's own re-renders
  // and the ResizeObserver that recomputes previewScale, leaving the live
  // preview's scale/position wrong after generating a PDF. Instead, this
  // never touches that style at all: each page is measured at whatever size
  // it's CURRENTLY rendered at (already reflecting any zoom in effect), and
  // html2canvas's own `scale` option is computed per element so the output
  // canvas still comes out at the page's true physical resolution.
  //
  // Superseded by downloadServerPdf below wherever `serverPdfExport` is
  // provided (every ReportShell-based report) - kept as the fallback for
  // callers that don't have a server-side print route yet (e.g.
  // TeacherListPage), see this file's module doc comment on
  // ServerPdfExportConfig.
  const downloadClientPdf = async () => {
    const pageEls = Array.from(
      document.querySelectorAll<HTMLElement>(".print-pages .print-page-preview"),
    );

    if (!pageEls.length) {
      useToastStore.getState().show("প্রিভিউ প্রস্তুত হয়নি, একটু পর আবার চেষ্টা করুন", "error");
      return;
    }

    pdfCancelRef.current = false;

    try {
      setGeneratingPdf(true);

      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      // Reports render in the self-hosted "Kalpurush" Bangla font, declared
      // in index.css with `font-display: optional` (deliberately, so the
      // live page never visibly flashes fallback-then-Kalpurush on first
      // load). `optional` means the browser gets a very short window to use
      // the font at all - if it isn't already available *for that specific
      // document*, the browser permanently commits that document to the
      // fallback (Hind Siliguri/Noto Sans Bengali) and never swaps to
      // Kalpurush later even after it finishes loading. html2canvas
      // rasterizes from its own freshly cloned document (a new iframe/realm
      // with its own font commitment), so simply awaiting `fonts.ready`
      // there (what the previous fix did) doesn't help once that clone has
      // already committed to the fallback - which is why matras/text kept
      // sitting lower and touching table borders in the captured PDF even
      // though the live preview looked fine. The fix: inject a *separate*
      // @font-face for the clone only, under a different family name, with
      // `font-display: block` (waits for the real font, no permanent
      // fallback commitment), and point the report's font stack at that name
      // just for this capture - `onclone` is the hook html2canvas actually
      // awaits before it starts painting.
      const forceKalpurushInClone = async (clonedDoc: Document) => {
        const style = clonedDoc.createElement("style");
        style.textContent = `
          @font-face {
            font-family: "KalpurushCapture";
            src: url("${window.location.origin}/fonts/Kalpurush.ttf") format("truetype");
            font-weight: 400 700;
            font-style: normal;
            font-display: block;
          }
          .print-page-preview, .print-page-preview * {
            font-family: "KalpurushCapture", "Hind Siliguri", "Noto Sans Bengali", sans-serif !important;
            /* Kalpurush.ttf is one static file covering the whole 400-700
               range declared above - there's no real bold face, so any
               bold/700-weight text (headings, table th) gets the browser's
               synthetic "faux bold" (an algorithmic stroke-thickening the
               native renderer applies at paint time). html2canvas doesn't
               reproduce that faux-bold pass faithfully for complex-script
               shaping - Bangla matras/conjuncts end up mispositioned and
               overlapping their base glyphs or neighbours (visible as text
               "merging into" itself and the surrounding borders), even
               though the exact same text at font-weight 400 renders
               perfectly. Forcing everything to 400 for this capture only
               avoids synthetic bold entirely - headers lose a little visual
               weight in the exported PDF, but render correctly instead of
               garbled, which matters more than boldness. */
            font-weight: 400 !important;
          }
        `;
        clonedDoc.head.appendChild(style);
        await clonedDoc.fonts.ready;
      };

      const baseSize = PAPER_SIZE_MM[paperSize];
      const pageWidthMm = orientation === "landscape" ? baseSize.height : baseSize.width;
      const pageHeightMm = orientation === "landscape" ? baseSize.width : baseSize.height;
      // True (unzoomed) page width in CSS px, for computing each element's
      // current zoom ratio below - not used as a render size.
      const truePageWidthPx = pageWidthMm * MM_TO_CSS_PX;
      const QUALITY_MULTIPLIER = 2;

      const pdf = new jsPDF({
        unit: "mm",
        format: [pageWidthMm, pageHeightMm],
        orientation,
      });

      for (let i = 0; i < pageEls.length; i++) {
        if (pdfCancelRef.current) {
          useToastStore.getState().show("PDF তৈরি বাতিল করা হয়েছে", "error");
          return;
        }

        setPdfProgress({ current: i + 1, total: pageEls.length });

        const renderedWidthPx = pageEls[i].getBoundingClientRect().width || truePageWidthPx;
        const captureScale = (truePageWidthPx / renderedWidthPx) * QUALITY_MULTIPLIER;

        const canvas = await html2canvas(pageEls[i], {
          scale: captureScale,
          useCORS: true,
          backgroundColor: "#ffffff",
          onclone: forceKalpurushInClone,
        });

        if (pdfCancelRef.current) {
          useToastStore.getState().show("PDF তৈরি বাতিল করা হয়েছে", "error");
          return;
        }

        const imageData = canvas.toDataURL("image/jpeg", 0.95);

        if (i > 0) pdf.addPage([pageWidthMm, pageHeightMm], orientation);
        pdf.addImage(imageData, "JPEG", 0, 0, pageWidthMm, pageHeightMm);
      }

      pdf.save(`${fileName}.pdf`);
      useToastStore.getState().show(`PDF ডাউনলোড হয়েছে (${fileName}.pdf)`, "success");
    } catch (error) {
      logger.error("PDF generation failed:", error);
      useToastStore.getState().show("PDF তৈরি করা যায়নি", "error");
    } finally {
      setGeneratingPdf(false);
      setPdfProgress(null);
      pdfCancelRef.current = false;
    }
  };

  // Renders through a real browser on the backend instead of approximating
  // it in a <canvas> - see ServerPdfExportConfig's doc comment above and
  // backend/src/modules/reports/controllers/report-export.service.ts.
  const downloadServerPdf = async (config: ServerPdfExportConfig) => {
    const controller = new AbortController();
    pdfAbortControllerRef.current = controller;

    try {
      setGeneratingPdf(true);

      const response = await api.post(
        "/reports/export-pdf",
        {
          reports_page: config.reportsPage,
          report_key: config.reportKey,
          ...config.filters,
          paper_size: paperSize,
          orientation,
          file_name: fileName,
        },
        {
          responseType: "blob",
          signal: controller.signal,
          // Overrides the shared `api` instance's 20s default - a cold
          // Chromium launch plus rendering+paginating a large multi-page
          // report server-side (see report-export.service.ts's own 30s
          // goto + 60s data-report-ready waits) can easily take longer than
          // that for a big report, and the default was cutting real,
          // still-in-progress requests off as a client-side timeout.
          timeout: 120_000,
        },
      );

      const blob = new Blob([response.data], { type: "application/pdf" });
      if (!blob.size) {
        throw new Error("Empty PDF response");
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileName}.pdf`;
      // Appended to the DOM before clicking, and the object URL revoked only
      // after a short delay - a detached <a> and an immediately-revoked blob
      // URL both "work" in most evergreen browsers, but for a multi-hundred-
      // KB PDF (unlike this file's small CSV export, which never hit this)
      // there's a real race where the browser hasn't finished reading the
      // blob by the time the URL is invalidated, silently dropping the
      // download with no error.
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 30_000);

      useToastStore.getState().show(`PDF ডাউনলোড হয়েছে (${fileName}.pdf)`, "success");
    } catch (error: any) {
      if (error?.code === "ERR_CANCELED" || error?.name === "CanceledError") {
        useToastStore.getState().show("PDF তৈরি বাতিল করা হয়েছে", "error");
      } else {
        // With `responseType: "blob"` set on the request, axios hands back
        // an error response body as a Blob too (even though the backend
        // actually sent JSON) - reading error.response.data directly would
        // just be "[object Blob]". Parse it back to text/JSON so a real
        // backend failure (bad params, Playwright crash, ...) shows its
        // actual message instead of the generic fallback below.
        let detail = "";
        const data = error?.response?.data;
        if (data instanceof Blob) {
          try {
            const text = await data.text();
            detail = JSON.parse(text)?.message || text;
          } catch {
            // not JSON/text - ignore, fall through to the generic message
          }
        }
        logger.error("PDF generation failed:", error, detail);
        useToastStore.getState().show(detail || "PDF তৈরি করা যায়নি", "error");
      }
    } finally {
      setGeneratingPdf(false);
      pdfAbortControllerRef.current = null;
    }
  };

  const handlePdfButtonClick = () => {
    if (generatingPdf) {
      pdfCancelRef.current = true;
      pdfAbortControllerRef.current?.abort();
      return;
    }
    if (serverPdfExport) downloadServerPdf(serverPdfExport);
    else downloadClientPdf();
  };

  return (
    <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto">
      {!hidePrintOptions && (
        <>
          <select
            value={paperSize}
            onChange={(e) => updatePaperSize(e.target.value as PaperSize)}
            className={`${selectFieldClass} min-w-[60px] flex-1 sm:flex-none`}
          >
            <option value="a4">A4</option>
            <option value="a5">A5</option>
          </select>

          <select
            value={orientation}
            onChange={(e) => updateOrientation(e.target.value as Orientation)}
            className={`${selectFieldClass} min-w-[88px] flex-1 sm:flex-none`}
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>

          <div ref={marginPanelRef} className="relative w-auto">
            <button
              type="button"
              onClick={() => setMarginPanelOpen((open) => !open)}
              title="মার্জিন - পেজের চার পাশের ফাঁকা জায়গা আলাদাভাবে কম-বেশি করুন"
              className="flex h-8 w-full items-center justify-center gap-1 whitespace-nowrap rounded-md border border-slate-300 bg-white px-2 text-[13px] font-medium text-slate-600 outline-none transition hover:bg-slate-50 focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/50 sm:w-auto"
            >
              <Ruler className="h-3 w-3" />
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
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
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
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
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
        className="flex h-8 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-emerald-200 bg-emerald-50 px-2 text-[13px] font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/50 sm:flex-none"
      >
        <FileSpreadsheet className="h-3 w-3" />
        Excel
      </button>

      <button
        type="button"
        onClick={downloadCSV}
        className="flex h-8 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-violet-200 bg-violet-50 px-2 text-[13px] font-semibold text-violet-700 transition hover:bg-violet-100 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-400 dark:hover:bg-violet-950/50 sm:flex-none"
      >
        <FileText className="h-3 w-3" />
        CSV
      </button>

      {!hidePrintOptions && (
        <>
          <button
            type="button"
            onClick={printData}
            className="flex h-8 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-md bg-slate-700 px-3 text-[13px] font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 sm:flex-none"
          >
            <Printer className="h-3 w-3" />
            Print
          </button>

          <button
            type="button"
            onClick={handlePdfButtonClick}
            title={generatingPdf ? "PDF তৈরি বাতিল করুন" : undefined}
            className={`flex h-8 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-md px-3 text-[13px] font-semibold text-white shadow-sm transition sm:flex-none ${
              generatingPdf ? "bg-rose-600 hover:bg-rose-700" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {generatingPdf ? <X className="h-3 w-3" /> : <FileDown className="h-3 w-3" />}
            {generatingPdf
              ? `বাতিল করুন${pdfProgress ? ` (${pdfProgress.current}/${pdfProgress.total})` : ""}`
              : "PDF"}
          </button>
        </>
      )}
    </div>
  );
};

export default DataExportPrintActions;
