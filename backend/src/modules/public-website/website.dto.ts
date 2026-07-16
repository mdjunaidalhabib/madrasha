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
  is_published?: unknown;
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
