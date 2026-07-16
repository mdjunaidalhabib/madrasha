import api from "./api";

export type BrandingPayload = {
  name?: string | null;
  address?: string | null;
  report_logo?: string | null;
  report_watermark?: string | null;
  report_watermark_opacity?: number;
};

export async function getBranding(): Promise<BrandingPayload> {
  const res = await api.get("/settings/branding");
  return res.data?.data || {};
}

export async function saveBranding(payload: BrandingPayload) {
  const res = await api.put("/settings/branding", payload);
  return res.data;
}

export async function deleteBrandingImage(field: "report_logo" | "report_watermark") {
  const res = await api.delete(`/settings/branding/${field}`);
  return res.data;
}
