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

export interface IdCardDesignData {
  id_card_design: string;
  id_card_background_image: string | null;
}

export interface AdmitCardDesignData {
  admit_card_design: string;
  admit_card_background_image: string | null;
}

export interface LetterDesignData {
  letter_design: string;
  letter_background_image: string | null;
}

export interface BookLabelDesignData {
  book_label_design: string;
  book_label_background_image: string | null;
}
