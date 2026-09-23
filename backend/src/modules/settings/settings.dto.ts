// Partial patch of BrandLayoutData - every key optional so the client can
// save a single changed knob (e.g. just name_font_size) without resending
// the rest, same "real partial update" pattern as UpdateBrandingRequestDto.
export interface UpdateBrandLayoutRequestDto {
  name_font_size?: number | string;
  name_color?: string | null;
  address_font_size?: number | string;
  address_color?: string | null;
  logo_size?: number | string;
  logo_position?: string;
  logo_offset_x?: number | string;
  logo_offset_y?: number | string;
  header_height?: number | string | null;
  footer_text?: string | null;
  footer_font_size?: number | string;
  footer_color?: string | null;
  footer_height?: number | string;
}

export interface UpdateBrandingRequestDto {
  name?: string;
  address?: string;
  phones?: string[];
  emails?: string[];
  report_logo?: string | null;
  report_banner?: string | null;
  report_watermark?: string | null;
  report_watermark_opacity?: number | string | null;
  report_header_footer_enabled?: unknown;
  report_header_image?: string | null;
  report_footer_image?: string | null;
  report_print_mode?: string;
  report_brand_layout?: UpdateBrandLayoutRequestDto;
  // Full replacement list (not a partial patch) - the client always sends
  // every field it knows about, in the order it wants them displayed, same
  // "resend the whole thing" pattern the designer's layer arrays use.
  marksheet_fields?: { key?: unknown; visible?: unknown; position?: unknown }[];
  // Same full-replacement pattern, for the admit-card "ডিফল্ট (সাধারণ)"
  // design's info fields.
  admit_card_fields?: { key?: unknown; visible?: unknown }[];
}

export interface UpdateSectionToggleRequestDto {
  key?: string;
  enabled?: unknown;
}

export interface UpdateDocumentTemplatesRequestDto {
  sanad_template?: string | null;
  testimonial_template?: string | null;
  transfer_letter_template?: string | null;
  admit_card_rules?: string | null;
  custom_notice_template?: string | null;
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

export interface UpdateIdCardBackRequestDto {
  issue_date?: string | null;
  expiry_date?: string | null;
  principal_title?: string | null;
  principal_signature?: string | null;
  lost_return_text?: string | null;
  default_design_id?: number | null;
}
