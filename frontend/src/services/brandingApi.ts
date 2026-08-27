import api, { cachedGet } from "./api";

export type ReportPrintMode = "normal" | "letterhead";

export type BrandingPayload = {
  name?: string | null;
  address?: string | null;
  phones?: string[];
  emails?: string[];
  report_logo?: string | null;
  report_banner?: string | null;
  report_watermark?: string | null;
  report_watermark_opacity?: number;
  report_header_footer_enabled?: boolean;
  report_header_image?: string | null;
  report_footer_image?: string | null;
  report_print_mode?: ReportPrintMode;
};

export async function getBranding(): Promise<BrandingPayload> {
  const res = await cachedGet("/settings/branding");
  return res.data?.data || {};
}

export async function saveBranding(payload: BrandingPayload) {
  const res = await api.put("/settings/branding", payload);
  return res.data;
}

export async function deleteBrandingImage(
  field: "report_logo" | "report_banner" | "report_watermark" | "report_header_image" | "report_footer_image",
) {
  const res = await api.delete(`/settings/branding/${field}`);
  return res.data;
}
