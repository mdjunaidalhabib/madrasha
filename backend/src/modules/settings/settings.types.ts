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
  logo_offset_x: number; // px, fine nudge on top of logo_position, +right/-left
  logo_offset_y: number; // px, fine nudge, +down/-up
  header_height: number | null; // mm, null = auto (content-driven, old behaviour)
  footer_text: string | null; // default text footer, null/empty = off
  footer_font_size: number; // px
  footer_color: string; // hex
  footer_height: number; // mm
}

// One row of the marksheet's info-field grid (রোল নম্বর/রেজিস্ট্রেশন নম্বর/
// শিক্ষার্থীর নাম/etc, see MARKSHEET_FIELD_KEYS in settings.constants.ts) -
// `visible` toggles it off the print, and the array's own order IS the
// display order (no separate position number needed).
export type MarksheetSignaturePosition = "left" | "center" | "right";

export interface MarksheetFieldItem {
  key: string;
  visible: boolean;
  // Only meaningful for the sig_* keys: which side of the marksheet the
  // signature line sits on (defaults: teacher left, principal right).
  position?: MarksheetSignaturePosition;
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
  marksheet_fields: MarksheetFieldItem[];
}

export type SectionTogglesData = Record<string, boolean>;

export interface DocumentTemplatesData {
  sanad_template: string | null;
  testimonial_template: string | null;
  transfer_letter_template: string | null;
  admit_card_rules: string | null;
  custom_notice_template: string | null;
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

/** আইডি কার্ডের পিছনের পাতার তথ্য (Madrasa.idCardBackSettings JSON)। তারিখ ISO "YYYY-MM-DD"। */
export interface IdCardBackData {
  issue_date: string | null;
  expiry_date: string | null;
  principal_title: string | null;
  principal_signature: string | null;
  lost_return_text: string | null;
  /** ডিফল্ট পিছনের ডিজাইনের id (বিল্ট-ইন, ঋণাত্মক) - null = "সাধারণ পিছন"। রিপোর্টের "পিছনের পাতা" ড্রপডাউন এটা দিয়েই শুরু হয়। */
  default_design_id: number | null;
}
