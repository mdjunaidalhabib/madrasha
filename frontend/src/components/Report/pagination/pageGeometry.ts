import { PaperSize, Orientation, PageMargins } from "../../common/DataExportPrintActions";

export const MM_TO_CSS_PX = 96 / 25.4;

// Used only for the preview-scale-to-fit calculation (how much to zoom the
// on-screen page so it fits the viewport) - never for content-height budget
// math. Content budgets read the real measured `clientHeight` of a
// `.print-page-preview` element instead, so they can never drift from the
// `padding: 10mm / 7mm` rules in index.css.
export const getPaperWidthMm = (paperSize: PaperSize, orientation: Orientation) => {
  if (paperSize === "a4") return orientation === "portrait" ? 210 : 297;
  return orientation === "portrait" ? 148 : 210;
};

export const getPaperHeightMm = (paperSize: PaperSize, orientation: Orientation) => {
  if (paperSize === "a4") return orientation === "portrait" ? 297 : 210;
  return orientation === "portrait" ? 210 : 148;
};

// Default margin (mm) for each side when the user hasn't customized any of
// them - matches the old uniform `padding: 10mm / 7mm` rule in index.css.
// Independently adjustable per side (see DataExportPrintActions' margin
// panel) so a report with, say, extra room reserved for a binding hole on
// the left doesn't have to also waste that space on the right.
export const getDefaultPageMargins = (paperSize: PaperSize): PageMargins => {
  const value = paperSize === "a5" ? 7 : 10;
  return { top: value, right: value, bottom: value, left: value };
};
