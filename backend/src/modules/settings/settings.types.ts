export interface BrandingData {
  name: string | null;
  address: string | null;
  report_logo: string | null;
  report_banner: string | null;
  report_watermark: string | null;
  report_watermark_opacity: number | null;
}

export interface DocumentTemplatesData {
  sanad_template: string | null;
  testimonial_template: string | null;
  transfer_letter_template: string | null;
  admit_card_rules: string | null;
  tokens: Record<string, string[]>;
}
