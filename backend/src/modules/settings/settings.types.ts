// Layout knobs for the DEFAULT logo+name+address header and the default
// text footer (only used while report_header_footer_enabled is off - the
// custom header/footer IMAGE path has its own fixed band size). Every field
// optional so a partial save only touches the knobs the user actually
// changed; getBranding always fills in BRAND_LAYOUT_DEFAULTS for anything
// missing before returning to the client.
export interface BrandLayoutData {
  name_font_size: number; // px
  name_color: string; // hex
  address_font_size: number; // px
  address_color: string; // hex
  logo_size: number; // px (square)
  logo_position: "left" | "center" | "right";
  header_height: number | null; // mm, null = auto (content-driven, old behaviour)
  footer_text: string | null; // default text footer, null/empty = off
  footer_font_size: number; // px
  footer_color: string; // hex
  footer_height: number; // mm
}

export interface BrandingData {
  name: string | null;
  address: string | null;
  phones: string[];
  emails: string[];
  report_logo: string | null;
  report_banner: string | null;
  report_watermark: string | null;
  report_watermark_opacity: number | null;
  report_header_footer_enabled: boolean;
  report_header_image: string | null;
  report_footer_image: string | null;
  report_print_mode: string;
  report_brand_layout: BrandLayoutData;
}

export type SectionTogglesData = Record<string, boolean>;

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

export interface MyPlanData {
  plan_name: string | null;
  price: number | null;
  duration_days: number | null;
  start_date: Date | null;
  end_date: Date | null;
  days_remaining: number | null;
  plan_status: string;
  has_active_subscription: boolean;
  student_limit: number;
  user_limit: number;
  usage: {
    students: number;
    users: number;
  };
}
