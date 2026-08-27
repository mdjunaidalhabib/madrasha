import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useBrandingStore } from "../../store/brandingStore";
import { toBanglaDigits } from "../../utils/reportUtils";

// Single source of truth for the custom header/footer image bands - reused
// by PaginatedReportPreview.tsx to reserve the matching amount of page
// height for the footer band (see the comment on FOOTER_BAND_MM there for
// why the header band needs no such separate reservation).
export const HEADER_BAND_MM = 40;
export const FOOTER_BAND_MM = 20;

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

  // Custom header is now an uploaded IMAGE, not typed text - its natural
  // width/height render at whatever size the image actually is, so there's
  // nothing here to canvas-measure/shrink the way the plain-text name is.
  const useCustomHeader = !!branding?.report_header_footer_enabled;
  // "প্রেস পেপার" (letterhead): the physical paper already has the
  // institution's letterhead pre-printed - nothing should render here, but
  // the content below still needs to start exactly where it would have if
  // an image WAS showing, so the printed table/text never lands on top of
  // that pre-printed artwork.
  const isLetterheadMode = useCustomHeader && branding?.report_print_mode === "letterhead";

  useLayoutEffect(() => {
    if (!compactMaxWidthPx || !nameText || useCustomHeader) {
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
  }, [compactMaxWidthPx, nameText, useCustomHeader]);

  // Enabling "কাস্টম হেডার-ফুটার" replaces the default logo+name+address
  // header entirely - even before an image is actually uploaded, in which
  // case this renders nothing at all (the space stays blank) rather than
  // falling back to the default. Letterhead mode is the one exception: it
  // ALWAYS reserves the blank band (see isLetterheadMode above), regardless
  // of whether a header image was ever uploaded.
  if (useCustomHeader) {
    if (isLetterheadMode) {
      return <div className="report-brand-header" style={{ height: `${HEADER_BAND_MM}mm` }} aria-hidden="true" />;
    }
    if (!branding?.report_header_image) return null;
    return (
      <div className="report-brand-header relative flex flex-col items-center text-center">
        {/* Fixed-size band (not just max-height on the <img> itself) so
            object-contain has both dimensions to fit within - guarantees the
            uploaded image is only ever letterboxed to fit, never stretched/
            distorted, regardless of its own aspect ratio. */}
        <div style={{ width: "100%", height: `${HEADER_BAND_MM}mm` }}>
          <img
            src={branding.report_header_image}
            alt=""
            className="h-full w-full object-contain"
          />
        </div>
      </div>
    );
  }

  if (!branding?.report_logo && !branding?.name && !branding?.address) return null;

  const showLogo = !!branding.report_logo && !hideLogo;

  return (
    <div
      className={`report-brand-header relative flex flex-col items-center text-center ${
        showLogo ? "report-brand-header--with-logo" : ""
      }`}
    >
      {showLogo && branding.report_logo && (
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

/**
 * Renders the madrasa's custom report footer IMAGE at the bottom of every
 * printed page, alongside the page-number footer - only when the "কাস্টম
 * হেডার-ফুটার" section is enabled AND a footer image is actually uploaded.
 * Renders nothing otherwise (no footer by default, matching pre-existing
 * behaviour - and no fallback to any default footer once enabled). In
 * letterhead mode this always renders a blank FOOTER_BAND_MM-tall spacer
 * instead (same reasoning as ReportBrandHeader's isLetterheadMode branch) -
 * PaginatedReportPreview.tsx reserves the matching page-bottom space for
 * both cases (see its FOOTER_BAND_MM usage).
 */
export function ReportBrandFooter() {
  const branding = useBrandingStore((s) => s.branding);
  const enabled = !!branding?.report_header_footer_enabled;

  if (enabled && branding?.report_print_mode === "letterhead") {
    return <div className="report-brand-footer" style={{ height: `${FOOTER_BAND_MM}mm` }} aria-hidden="true" />;
  }

  if (!enabled || !branding?.report_footer_image) return null;

  return (
    <div className="report-brand-footer" style={{ height: `${FOOTER_BAND_MM}mm` }}>
      <img src={branding.report_footer_image} alt="" className="h-full w-full object-contain" />
    </div>
  );
}
