// Whitelist of tokens allowed inside each document template. Anything else
// typed in curly braces is left as plain text (harmless) rather than
// treated as a data field, so admins cannot invent a fake "data" token.
export const TEMPLATE_TOKENS: Record<string, string[]> = {
  sanad_template: [
    "student_name",
    "father_name",
    "mother_name",
    "division_name",
    "class_name",
    "academic_year",
    "result_summary",
  ],
  testimonial_template: ["student_name", "father_name", "class_name", "division_name"],
  transfer_letter_template: [
    "student_name",
    "father_name",
    "id",
    "class_name",
    "division_name",
    "academic_year",
  ],
  admit_card_rules: ["exam_name", "academic_year"],
};

export const MAX_TEMPLATE_LENGTH = 4000;
export const MAX_MADRASA_NAME_LENGTH = 200;
export const MAX_MADRASA_ADDRESS_LENGTH = 255;
export const DEFAULT_WATERMARK_OPACITY = 0.08;

export const MAX_BRANDING_PHONE_LENGTH = 20;
export const MAX_BRANDING_EMAIL_LENGTH = 120;
export const MAX_BRANDING_CONTACT_ITEMS = 5;

export const BRANDING_IMAGE_FIELDS: Record<
  string,
  "reportLogo" | "reportBanner" | "reportWatermark" | "reportHeaderImage" | "reportFooterImage"
> = {
  report_logo: "reportLogo",
  report_banner: "reportBanner",
  report_watermark: "reportWatermark",
  report_header_image: "reportHeaderImage",
  report_footer_image: "reportFooterImage",
};

// Shared by id-card, admit-card and letter (sanad/testimonial/transfer)
// design settings — all three use the same 4-way preset/custom choice.
export const DOCUMENT_DESIGNS = ["classic", "minimal", "arch", "custom"] as const;
export const DEFAULT_DOCUMENT_DESIGN = "classic";

// "normal": header/footer + logo/background/watermark print as configured.
// "letterhead": the physical paper is already pre-printed at a press, so
// only the main content text prints - no logo/background/watermark/header/
// footer at all.
export const REPORT_PRINT_MODES = ["normal", "letterhead"] as const;
export const DEFAULT_REPORT_PRINT_MODE = "normal";

// Allow-list of SectionCard keys that can be toggled enabled/disabled from
// AdminWebsiteSettingsPage (website builder settings) - prevents an
// arbitrary string being stored in settingsSectionToggles.
export const SETTINGS_SECTION_KEYS = [
  "website_section_visibility",
  "website_institution_info",
  "website_theme_color",
  "website_hero_banner",
  "website_notice_bar",
  "website_muhtamim_message",
  "website_social_links",
  "website_page_content",
  "website_notice_add",
  "website_notice_list",
  "website_gallery_add",
  "website_gallery_list",
  "website_slider_add",
  "website_slider_list",
  "website_committee_add",
  "website_committee_list",
] as const;
