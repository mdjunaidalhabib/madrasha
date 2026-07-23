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

export const BRANDING_IMAGE_FIELDS: Record<string, "reportLogo" | "reportBanner" | "reportWatermark"> = {
  report_logo: "reportLogo",
  report_banner: "reportBanner",
  report_watermark: "reportWatermark",
};
