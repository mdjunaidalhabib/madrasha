import api, { cachedGet } from "./api";

export type ReportPrintMode = "normal" | "letterhead";

export type BrandLogoPosition = "left" | "center" | "right";

// Layout knobs for the DEFAULT logo+name+address header and default text
// footer - only applied while report_header_footer_enabled is off. Mirrors
// backend/src/modules/settings/settings.types.ts's BrandLayoutData.
export type BrandLayout = {
  name_font_size: number;
  name_color: string;
  address_font_size: number;
  address_color: string;
  logo_size: number;
  logo_position: BrandLogoPosition;
  logo_offset_x: number;
  logo_offset_y: number;
  header_height: number | null;
  footer_text: string | null;
  footer_font_size: number;
  footer_color: string;
  footer_height: number;
};

// Same shape as BrandLayout but every key optional, for partial saves (one
// slider/color-picker change at a time - matches the rest of this page's
// inline-edit pattern).
export type BrandLayoutPatch = Partial<BrandLayout>;

export const BRAND_LAYOUT_DEFAULTS: BrandLayout = {
  name_font_size: 27,
  name_color: "#000000",
  address_font_size: 16,
  address_color: "#000000",
  logo_size: 95,
  logo_position: "left",
  logo_offset_x: 0,
  logo_offset_y: 0,
  header_height: null,
  footer_text: null,
  footer_font_size: 10,
  footer_color: "#334155",
  footer_height: 12,
};

export type MarksheetSignaturePosition = "left" | "center" | "right";

// One row of the marksheet's info-field grid (রোল নম্বর/রেজিস্ট্রেশন নম্বর/
// শিক্ষার্থীর নাম/etc - see MARKSHEET_FIELD_LABELS_BN below). `visible`
// toggles it off the print; the array's own order IS the display order.
export type MarksheetFieldItem = {
  key: string;
  visible: boolean;
  // Only for the sig_* keys: which side of the marksheet the signature sits on.
  position?: MarksheetSignaturePosition;
};

// Mirrors backend/src/modules/settings/settings.constants.ts's
// MARKSHEET_FIELD_KEYS/DEFAULT_MARKSHEET_FIELDS exactly - same original
// hardcoded order MarksheetList.tsx's INFO_FIELDS already renders in, so an
// untouched madrasa's marksheet prints pixel-identical to before this
// feature existed.
export const DEFAULT_MARKSHEET_FIELDS: MarksheetFieldItem[] = [
  "student_name",
  "father_name",
  "roll",
  "registration_no",
  "date_of_birth",
  "madrasa_grade",
  "general_grade",
  "status",
  "rank_no",
  "sig_teacher",
  "sig_principal",
].map((key) => ({ key, visible: true }));

export const MARKSHEET_FIELD_LABELS_BN: Record<string, string> = {
  roll: "রোল নম্বর",
  registration_no: "রেজিস্ট্রেশন নম্বর",
  date_of_birth: "জন্ম তারিখ",
  student_name: "শিক্ষার্থীর নাম",
  father_name: "পিতার নাম",
  madrasa_grade: "ফলাফল বিভাগ",
  general_grade: "গ্রেড",
  status: "ফলাফল",
  rank_no: "মেধাস্থান",
  sig_teacher: "শ্রেণি শিক্ষকের স্বাক্ষর",
  sig_principal: "মুহতামিমের স্বাক্ষর",
};

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
  report_brand_layout?: BrandLayoutPatch | BrandLayout;
  marksheet_fields?: MarksheetFieldItem[];
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
