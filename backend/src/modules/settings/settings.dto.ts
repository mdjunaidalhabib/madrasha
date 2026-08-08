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

export interface UpdateIdCardDesignRequestDto {
  id_card_design?: string;
  id_card_background_image?: string | null;
}

export interface UpdateAdmitCardDesignRequestDto {
  admit_card_design?: string;
  admit_card_background_image?: string | null;
}

export interface UpdateLetterDesignRequestDto {
  letter_design?: string;
  letter_background_image?: string | null;
}

export interface UpdateBookLabelDesignRequestDto {
  book_label_design?: string;
  book_label_background_image?: string | null;
}
