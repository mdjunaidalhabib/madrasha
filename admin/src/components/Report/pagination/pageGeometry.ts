import { PaperSize, Orientation, PageMargins } from "../../common/DataExportPrintActions";

export const MM_TO_CSS_PX = 96 / 25.4;

// Used only for the preview-scale-to-fit calculation (how much to zoom the
// on-screen page so it fits the viewport) - never for content-height budget
// math. Content budgets read the real measured `clientHeight` of a
// `.print-page-preview` element instead, so they can never drift from the
// default padding rules in index.css.
export const getPaperWidthMm = (paperSize: PaperSize, orientation: Orientation) => {
  if (paperSize === "a4") return orientation === "portrait" ? 210 : 297;
  return orientation === "portrait" ? 148 : 210;
};

export const getPaperHeightMm = (paperSize: PaperSize, orientation: Orientation) => {
  if (paperSize === "a4") return orientation === "portrait" ? 297 : 210;
  return orientation === "portrait" ? 210 : 148;
};

// Default margins (mm): 14mm (A4) / 12mm (A5) on top, 10mm on other sides.
// Independently adjustable per side (see DataExportPrintActions' margin
// panel) so a report with, say, extra room reserved for a binding hole on
// the left doesn't have to also waste that space on the right.
export const getDefaultPageMargins = (paperSize: PaperSize): PageMargins => {
  return { top: paperSize === "a5" ? 12 : 14, right: 10, bottom: 10, left: 10 };
};

// Per-report default margins (what ReportShell starts with and "ডিফল্ট সেট" resets to).
export const getReportDefaultMargins = (paperSize: PaperSize, _printable?: string): PageMargins => {
  const margins = getDefaultPageMargins(paperSize);
  return margins;
};
