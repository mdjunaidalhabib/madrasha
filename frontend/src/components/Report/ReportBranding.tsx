import { useEffect } from "react";
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

/**
 * Renders the madrasa's logo + name + address header automatically at the
 * top of every report/print page. Safe to render even when nothing is set
 * (renders nothing in that case).
 */
export function ReportBrandHeader() {
  const branding = useBrandingStore((s) => s.branding);
  const fetchBranding = useBrandingStore((s) => s.fetchBranding);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  if (!branding?.report_logo && !branding?.name && !branding?.address) return null;

  return (
    <div className="report-brand-header flex flex-col items-center text-center">
      {branding.report_logo && (
        <img src={branding.report_logo} alt="Logo" className="report-brand-logo object-contain" />
      )}
      {branding.name && <div className="report-brand-name text-black">{toBanglaDigits(branding.name)}</div>}
      {branding.address && (
        <div className="report-brand-address text-black">{toBanglaDigits(branding.address)}</div>
      )}
    </div>
  );
}
