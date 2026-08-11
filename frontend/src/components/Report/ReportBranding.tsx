import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useBrandingStore } from "../../store/brandingStore";
import { toBanglaDigits } from "../../utils/reportUtils";

/**
 * Renders the madrasa's uploaded background image behind the report content.
 * Place once, inside `.print-area`, before `ReportWatermark`. Purely visual —
 * it never touches report field data.
 */
export function ReportBackground() {
  const branding = useBrandingStore((s) => s.branding);
  const fetchBranding = useBrandingStore((s) => s.fetchBranding);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  if (!branding?.report_banner) return null;

  return (
    <div className="report-background" aria-hidden="true">
      <img src={branding.report_banner} alt="" />
    </div>
  );
}

/**
 * Renders the madrasa's watermark (behind content) automatically.
 * Place once, inside `.print-area`, as a sibling before the report content.
 */
export function ReportWatermark() {
  const branding = useBrandingStore((s) => s.branding);
  const fetchBranding = useBrandingStore((s) => s.fetchBranding);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  if (!branding?.report_watermark) return null;

  const opacity =
    branding.report_watermark_opacity !== undefined && branding.report_watermark_opacity !== null
      ? Number(branding.report_watermark_opacity)
      : 0.08;

  return (
    <div className="report-watermark" style={{ opacity }} aria-hidden="true">
      <img src={branding.report_watermark} alt="" />
    </div>
  );
}

let brandNameMeasureCtx: CanvasRenderingContext2D | null | undefined;
const getBrandNameMeasureContext = () => {
  if (brandNameMeasureCtx === undefined) {
    brandNameMeasureCtx =
      typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  }
  return brandNameMeasureCtx;
};

const COMPACT_NAME_START_PX = 20;
const COMPACT_NAME_MIN_PX = 8;
// Leaves a little breathing room inside the .report-brand-name box's own
// max-width (94%/96% of the header, see index.css) instead of measuring
// right up to the edge.
const COMPACT_NAME_WIDTH_MARGIN = 0.92;

/**
 * Renders the madrasa's logo + name + address header automatically at the
 * top of every report/print page. Safe to render even when nothing is set
 * (renders nothing in that case).
 */
export function ReportBrandHeader({
  compactMaxWidthPx,
  hideLogo = false,
}: {
  // Set only where this header renders twice per physical page at roughly
  // half the normal page width (exam-signature-number-sheet-2col - each
  // column becomes its own standalone sheet after cutting). The institution
  // name is measured (canvas, same technique AcademicResultPrint uses for
  // subject-name columns) and shrunk until it's guaranteed to fit on one
  // line within this width, instead of wrapping to two/three lines and
  // eating into the column's already-tight row budget.
  compactMaxWidthPx?: number;
  // exam-signature-number-sheet-2col only: the logo is dropped there to
  // leave more room for a bigger institution name at that narrow width.
  hideLogo?: boolean;
} = {}) {
  const branding = useBrandingStore((s) => s.branding);
  const fetchBranding = useBrandingStore((s) => s.fetchBranding);
  const nameRef = useRef<HTMLDivElement>(null);
  const [compactNameFontPx, setCompactNameFontPx] = useState<number | null>(null);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  const nameText = branding?.name ? toBanglaDigits(branding.name) : "";

  useLayoutEffect(() => {
    if (!compactMaxWidthPx || !nameText) {
      setCompactNameFontPx(null);
      return;
    }
    const ctx = getBrandNameMeasureContext();
    const el = nameRef.current;
    if (!ctx || !el) return;

    const fontFamily = getComputedStyle(el).fontFamily;
    const budgetPx = compactMaxWidthPx * COMPACT_NAME_WIDTH_MARGIN;

    let fontPx = COMPACT_NAME_START_PX;
    ctx.font = `800 ${fontPx}px ${fontFamily}`;
    while (ctx.measureText(nameText).width > budgetPx && fontPx > COMPACT_NAME_MIN_PX) {
      fontPx -= 0.5;
      ctx.font = `800 ${fontPx}px ${fontFamily}`;
    }

    setCompactNameFontPx(fontPx);
  }, [compactMaxWidthPx, nameText]);

  if (!branding?.report_logo && !branding?.name && !branding?.address) return null;

  return (
    <div className="report-brand-header relative flex flex-col items-center text-center">
      {branding.report_logo && !hideLogo && (
        <img src={branding.report_logo} alt="Logo" className="report-brand-logo object-contain" />
      )}
      {branding.name && (
        <div
          ref={nameRef}
          className="report-brand-name text-black"
          style={
            compactMaxWidthPx
              ? { whiteSpace: "nowrap", fontSize: compactNameFontPx ?? COMPACT_NAME_START_PX }
              : undefined
          }
        >
          {nameText}
        </div>
      )}
      {branding.address && (
        <div className="report-brand-address text-black">{toBanglaDigits(branding.address)}</div>
      )}
    </div>
  );
}
