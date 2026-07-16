import api from "./api";
import adminApi from "./adminApi";

export type WebsiteSettingsPayload = {
  madrasa_id?: number;
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  logo_url?: string;
  hero_title?: string;
  hero_subtitle?: string;
  theme_color?: string;
  show_notices?: 0 | 1;
  show_gallery?: 0 | 1;
  show_teachers?: 0 | 1;
  show_admission?: 0 | 1;
  show_about?: 0 | 1;
  show_contact?: 0 | 1;
  is_published?: 0 | 1;
};

export type WebsitePagePayload = {
  page_key: string;
  title: string;
  content?: string;
  is_published?: 0 | 1;
  sort_order?: number;
};

export type WebsiteNoticePayload = {
  id?: number;
  title: string;
  content?: string;
  is_published?: 0 | 1;
};

export type WebsiteGalleryPayload = {
  id?: number;
  title?: string;
  image_url: string;
  is_published?: 0 | 1;
  sort_order?: number;
};

export async function getPublicWebsite(slug: string) {
  const res = await api.get(`/website/public/${slug}`);
  return res.data.data;
}

export async function getWebsiteSettings(madrasaId?: number) {
  const res = await api.get("/website/admin/settings", {
    params: madrasaId ? { madrasa_id: madrasaId } : undefined,
  });
  return res.data.data;
}

export async function saveWebsiteSettings(payload: WebsiteSettingsPayload) {
  const res = await api.put("/website/admin/settings", payload);
  return res.data;
}

export async function saveWebsitePage(payload: WebsitePagePayload) {
  const res = await api.put("/website/admin/pages", payload);
  return res.data;
}

export async function saveWebsiteNotice(payload: WebsiteNoticePayload) {
  const res = await api.post("/website/admin/notices", payload);
  return res.data;
}

export async function deleteWebsiteNotice(id: number) {
  const res = await api.delete(`/website/admin/notices/${id}`);
  return res.data;
}

export async function saveWebsiteGalleryItem(payload: WebsiteGalleryPayload) {
  const res = await api.post("/website/admin/gallery", payload);
  return res.data;
}

export async function deleteWebsiteGalleryItem(id: number) {
  const res = await api.delete(`/website/admin/gallery/${id}`);
  return res.data;
}

export async function updateMadrasaWebsiteStatus(
  id: number,
  status: "active" | "limited" | "disabled",
) {
  const res = await adminApi.patch(`/website/super/madrasas/${id}/status`, { status });
  return res.data;
}
