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

// প্রবেশপত্রের "ডিফল্ট (সাধারণ)" ডিজাইনের তথ্য-ফিল্ড গ্রিড (নাম/পিতার নাম/শ্রেণি/
// রোল/রেজি. নম্বর/শিক্ষাবর্ষ) - marksheet_fields-এর মতোই: `visible` প্রিন্ট থেকে
// বাদ দেয়, array-এর ক্রমই প্রদর্শনের ক্রম।
export type AdmitCardFieldItem = { key: string; visible: boolean };

// backend/src/modules/settings/settings.constants.ts-এর ADMIT_CARD_FIELD_KEYS ও
// packages/shared-ui/.../admitCardDesigns.ts-এর ADMIT_CARD_FIELD_KEYS মিরর করে -
// একই কী-লিস্ট, মূল হার্ডকোড করা ক্রম (আনটাচড মাদরাসার প্রবেশপত্র আগের মতোই দেখাবে)।
export const DEFAULT_ADMIT_CARD_FIELDS: AdmitCardFieldItem[] = [
  "student_name",
  "father_name",
  "class_name",
  "roll",
  "registration_no",
  "academic_year",
].map((key) => ({ key, visible: true }));

export const ADMIT_CARD_FIELD_LABELS_BN: Record<string, string> = {
  student_name: "পরীক্ষার্থীর নাম",
  father_name: "পিতার নাম",
  class_name: "শ্রেণি",
  roll: "রোল নম্বর",
  registration_no: "রেজিস্ট্রেশন নম্বর",
  academic_year: "শিক্ষাবর্ষ",
};

// backend/src/modules/settings/settings.constants.ts-এর SOCIAL_LINK_TYPES মিরর করে।
// "whatsapp"-এ value হলো নম্বর, বাকি সবগুলোতে পূর্ণ লিংক (URL)।
export const SOCIAL_LINK_TYPES = [
  "whatsapp",
  "facebook_page",
  "facebook_profile",
  "facebook_group",
  "youtube",
  "instagram",
  "telegram",
  "tiktok",
  "x",
  "linkedin",
  "website",
  "other",
] as const;
export type SocialLinkType = (typeof SOCIAL_LINK_TYPES)[number];

export const SOCIAL_LINK_TYPE_LABELS_BN: Record<SocialLinkType, string> = {
  whatsapp: "WhatsApp নম্বর",
  facebook_page: "Facebook পেজ",
  facebook_profile: "Facebook প্রোফাইল",
  facebook_group: "Facebook গ্রুপ",
  youtube: "YouTube চ্যানেল",
  instagram: "Instagram",
  telegram: "Telegram",
  tiktok: "TikTok",
  x: "X (Twitter)",
  linkedin: "LinkedIn",
  website: "ওয়েবসাইট",
  other: "অন্যান্য",
};

export const MAX_SOCIAL_LINKS = 20;

export type SocialLinkItem = { type: SocialLinkType; label: string | null; value: string };

export type BrandingPayload = {
  name?: string | null;
  address?: string | null;
  phones?: string[];
  emails?: string[];
  social_links?: SocialLinkItem[];
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
  admit_card_fields?: AdmitCardFieldItem[];
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
