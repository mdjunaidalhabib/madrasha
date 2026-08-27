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
