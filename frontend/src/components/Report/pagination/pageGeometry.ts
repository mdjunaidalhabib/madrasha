import { PaperSize, Orientation } from "../../common/DataExportPrintActions";

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

// Must mirror the `padding` shorthand on `.print-page-preview` in
// index.css (base rule ~line 155 for a4, the `html[data-print-size="a5"]...`
// overrides ~lines 400/406 for a5) - both screen preview and the
// `@media print` block share these same values, so a measurement container
// built from this constant matches what actually prints.
export const getPagePaddingMm = (paperSize: PaperSize) => (paperSize === "a5" ? 7 : 10);
