export interface UpsertWebsiteSettingsRequestDto {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  logo_url?: string;
  hero_title?: string;
  hero_subtitle?: string;
  theme_color?: string;
  show_notices?: unknown;
  show_gallery?: unknown;
  show_teachers?: unknown;
  show_admission?: unknown;
  show_about?: unknown;
  show_contact?: unknown;
  show_slider?: unknown;
  show_muhtamim?: unknown;
  show_committee?: unknown;
  show_notice_bar?: unknown;
  notice_bar_text?: string;
  is_published?: unknown;
  muhtamim_name?: string;
  muhtamim_designation?: string;
  muhtamim_photo?: string;
  muhtamim_message?: string;
  facebook_url?: string;
  youtube_url?: string;
  instagram_url?: string;
  whatsapp_channel_url?: string;
}

export interface SaveWebsiteSlideRequestDto {
  id?: number;
  title?: string;
  subtitle?: string;
  image_url: string;
  button_text?: string;
  button_link?: string;
  is_published?: unknown;
  sort_order?: number | string;
}

export interface SaveWebsiteCommitteeMemberRequestDto {
  id?: number;
  name: string;
  designation?: string;
  photo_url?: string;
  phone?: string;
  is_published?: unknown;
  sort_order?: number | string;
}

export interface SubmitWebsiteAdmissionApplicationRequestDto {
  student_name: string;
  father_name?: string;
  mother_name?: string;
  gender?: string;
  date_of_birth?: string;
  class_applied?: string;
  guardian_phone?: string;
  address?: string;
  note?: string;
}

export interface UpdateWebsiteAdmissionStatusRequestDto {
  status: string;
}

export interface UpsertWebsitePageRequestDto {
  page_key: string;
  title: string;
  content?: string;
  is_published?: unknown;
  sort_order?: number | string;
}

export interface SaveWebsiteNoticeRequestDto {
  id?: number;
  title: string;
  content?: string;
  is_published?: unknown;
}

export interface SaveWebsiteGalleryItemRequestDto {
  id?: number;
  title?: string;
  image_url: string;
  is_published?: unknown;
  sort_order?: number | string;
}

export interface UpdateWebsiteStatusRequestDto {
  status: string;
}
