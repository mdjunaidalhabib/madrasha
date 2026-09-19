import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useBrandingStore } from "../../store/brandingStore";
import { toBanglaDigits } from "@madrasha/shared-ui/src/utils/reportUtils";
import { BRAND_LAYOUT_DEFAULTS, type BrandingPayload, type BrandLayout } from "../../services/brandingApi";

// Single source of truth for the custom header/footer image bands - reused
// by PaginatedReportPreview.tsx to reserve the matching amount of page
// height for the footer band (see the comment on FOOTER_BAND_MM there for
// why the header band needs no such separate reservation).
export const HEADER_BAND_MM = 40;
export const FOOTER_BAND_MM = 20;

function resolveBrandLayout(branding: BrandingPayload | null | undefined): BrandLayout {
  return { ...BRAND_LAYOUT_DEFAULTS, ...(branding?.report_brand_layout ?? {}) };
}

// How much bottom page-space the footer band (custom image OR default text)
// needs reserved, in mm - used by PaginatedReportPreview.tsx's pagination
// math the same way FOOTER_BAND_MM used to be used directly, since both the
// image and the text footer are absolutely-positioned overlays whose height
// is never picked up by normal DOM flow measurement. Returns 0 whenever
// nothing will actually render (matches ReportBrandFooter's own render
// conditions below).
export function getFooterBandReserveMm(branding: BrandingPayload | null | undefined): number {
  const enabled = !!branding?.report_header_footer_enabled;
  if (enabled) {
    const isLetterhead = branding?.report_print_mode === "letterhead";
    return isLetterhead || !!branding?.report_footer_image ? FOOTER_BAND_MM : 0;
  }
  const layout = resolveBrandLayout(branding);
  return layout.footer_text ? layout.footer_height : 0;
}

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
  const layout = resolveBrandLayout(branding);

  // Only emit an inline override when the value actually differs from the
  // shipped default - otherwise every report keeps using the existing
  // paper-size/orientation-responsive CSS rules (index.css's a4/a5/
  // landscape variants) untouched, so a madrasa that never opened the new
  // "ডিফল্ট হেডার-ফুটার ডিজাইন" section renders pixel-identical to before.
  // Once a knob IS customized it applies at that fixed value across every
  // paper size (it intentionally stops auto-adapting - the admin picked it).
  const nameStyle: CSSProperties = {};
  if (layout.name_font_size !== BRAND_LAYOUT_DEFAULTS.name_font_size) nameStyle.fontSize = layout.name_font_size;
  if (layout.name_color !== BRAND_LAYOUT_DEFAULTS.name_color) nameStyle.color = layout.name_color;

  const addressStyle: CSSProperties = {};
  if (layout.address_font_size !== BRAND_LAYOUT_DEFAULTS.address_font_size)
    addressStyle.fontSize = layout.address_font_size;
  if (layout.address_color !== BRAND_LAYOUT_DEFAULTS.address_color) addressStyle.color = layout.address_color;

  const logoStyle: CSSProperties = {};
  // Fine nudge (logo_offset_x/y) layers on top of the left/center/right
  // base position. The horizontal nudge is plain left/right/translateX; the
  // vertical one goes through --report-logo-offset-y (set on the header
  // below) so .report-brand-logo's top: max(0px, ...) in index.css can clamp
  // it - a negative nudge must never lift the logo above the header's top
  // edge into the page margin.
  const offsetX = layout.logo_offset_x || 0;
  const offsetY = layout.logo_offset_y || 0;
  if (layout.logo_position === "center") {
    logoStyle.left = "50%";
    logoStyle.transform = `translateX(calc(-50% + ${offsetX}px))`;
  } else if (layout.logo_position === "right") {
    logoStyle.left = "auto";
    logoStyle.right = 28 - offsetX;
  } else if (offsetX) {
    logoStyle.left = 28 + offsetX;
  }

  const headerStyle: CSSProperties & Record<`--${string}`, string | number> = {};
  if (layout.logo_size !== BRAND_LAYOUT_DEFAULTS.logo_size) {
    headerStyle["--report-logo-size"] = `${layout.logo_size}px`;
  }
  if (offsetY) headerStyle["--report-logo-offset-y"] = `${offsetY}px`;
  if (layout.header_height !== null) headerStyle.minHeight = `${layout.header_height}mm`;
  // The logo can hang a little below the header's own flow box, into the gap
  // (margin-bottom) reserved under it - the report's heading right below
  // would otherwise render underneath it. The shipped CSS
  // (.report-brand-header--with-logo) reserves a fixed amount sized for the
  // *default* 95px logo - once the logo is resized or nudged vertically, that
  // fixed reservation is wrong (too little if bigger/lower, wastefully too
  // much if smaller/higher, which is exactly the "empty gap under the header"
  // this covers). Only override once something is actually customized, so an
  // untouched madrasa keeps the exact old CSS-driven gap. Goes through
  // --report-brand-gap (not marginBottom directly) because the logo sizes
  // itself against that same variable - see .report-brand-logo in index.css,
  // which shrinks the logo to fit instead of ever growing this gap or the
  // header (that pushed every report's text down).
  if (showLogo && (layout.logo_size !== BRAND_LAYOUT_DEFAULTS.logo_size || offsetY !== 0)) {
    const overhangPx = layout.logo_size * 0.15 + Math.max(0, offsetY);
    headerStyle["--report-brand-gap"] = `${Math.ceil(overhangPx + 6)}px`;
  }

  return (
    <div
      className={`report-brand-header relative flex flex-col items-center text-center ${
        showLogo ? "report-brand-header--with-logo" : ""
      }`}
      style={headerStyle}
    >
      {showLogo && branding.report_logo && (
        <img
          src={branding.report_logo}
          alt="Logo"
          className="report-brand-logo object-contain"
          style={logoStyle}
        />
      )}
      {branding.name && (
        <div
          ref={nameRef}
          className="report-brand-name text-black"
          style={
            compactMaxWidthPx
              ? {
                  whiteSpace: "nowrap",
                  fontSize: compactNameFontPx ?? COMPACT_NAME_START_PX,
                  // Compact (2-col letterhead) mode always uses its own
                  // canvas-measured font size to guarantee a single line at
                  // that narrow width - a customized name_font_size would
                  // break that guarantee, so only the color override
                  // applies here, never the size.
                  ...(nameStyle.color ? { color: nameStyle.color } : {}),
                }
              : nameStyle
          }
        >
          {nameText}
        </div>
      )}
      {branding.address && (
        <div className="report-brand-address text-black" style={addressStyle}>
          {toBanglaDigits(branding.address)}
        </div>
      )}
    </div>
  );
}

/**
 * Renders the madrasa's custom report footer IMAGE (when "কাস্টম হেডার-ফুটার"
 * is enabled and a footer image is uploaded), OR the default plain-text
 * footer (when that toggle is off and footer text is set in "ডিফল্ট
 * হেডার-ফুটার ডিজাইন"). Renders nothing when neither applies. In letterhead
 * mode this always renders a blank FOOTER_BAND_MM-tall spacer instead (same
 * reasoning as ReportBrandHeader's isLetterheadMode branch) -
 * PaginatedReportPreview.tsx reserves the matching page-bottom space for
 * every case via getFooterBandReserveMm() above.
 */
export function ReportBrandFooter() {
  const branding = useBrandingStore((s) => s.branding);
  const enabled = !!branding?.report_header_footer_enabled;

  if (enabled && branding?.report_print_mode === "letterhead") {
    return <div className="report-brand-footer" style={{ height: `${FOOTER_BAND_MM}mm` }} aria-hidden="true" />;
  }

  if (enabled) {
    if (!branding?.report_footer_image) return null;
    return (
      <div className="report-brand-footer" style={{ height: `${FOOTER_BAND_MM}mm` }}>
        <img src={branding.report_footer_image} alt="" className="h-full w-full object-contain" />
      </div>
    );
  }

  const layout = resolveBrandLayout(branding);
  if (!layout.footer_text) return null;

  return (
    <div
      className="report-brand-footer"
      style={{
        height: `${layout.footer_height}mm`,
        fontSize: layout.footer_font_size,
        color: layout.footer_color,
      }}
    >
      {toBanglaDigits(layout.footer_text)}
    </div>
  );
}
