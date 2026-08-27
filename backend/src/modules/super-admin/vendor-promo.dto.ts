export interface SaveVendorPromoConfigRequestDto {
  is_enabled?: boolean;
  company_name?: string;
  tagline?: string;
  teaser_text?: string;
  detail_link_text?: string;
  hero_title?: string;
  hero_text?: string;
  founder_name?: string;
  founder_title?: string;
  founder_location?: string;
  founder_bio?: string;
  /** Comma-separated skill tags, e.g. "React, Next.js, SEO". */
  founder_skills?: string;
  founder_photo_url?: string;
  founder_facebook_url?: string;
  phone_display?: string;
  phone_intl?: string;
  email?: string;
  website?: string;
  address?: string;
}

export interface CreateVendorServiceRequestDto {
  label?: string;
  desc?: string;
  icon_key?: string;
  is_current?: boolean;
}

export interface UpdateVendorServiceRequestDto extends CreateVendorServiceRequestDto {
  is_active?: boolean;
}
