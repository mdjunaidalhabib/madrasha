export interface UpdateBrandingRequestDto {
  name?: string;
  address?: string;
  report_logo?: string | null;
  report_banner?: string | null;
  report_watermark?: string | null;
  report_watermark_opacity?: number | string | null;
}

export interface UpdateDocumentTemplatesRequestDto {
  sanad_template?: string | null;
  testimonial_template?: string | null;
  transfer_letter_template?: string | null;
  admit_card_rules?: string | null;
}
