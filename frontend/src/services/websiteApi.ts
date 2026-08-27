import api, { cachedGet } from "./api";
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
  show_slider?: 0 | 1;
  show_muhtamim?: 0 | 1;
  show_committee?: 0 | 1;
  show_notice_bar?: 0 | 1;
  notice_bar_text?: string;
  notice_bar_speed?: number;
  is_published?: 0 | 1;
  muhtamim_name?: string;
  muhtamim_designation?: string;
  muhtamim_photo?: string;
  muhtamim_message?: string;
  facebook_url?: string;
  youtube_url?: string;
  instagram_url?: string;
  whatsapp_channel_url?: string;
};

export type WebsiteSlidePayload = {
  id?: number;
  title?: string;
  subtitle?: string;
  image_url: string;
  button_text?: string;
  button_link?: string;
  is_published?: 0 | 1;
  sort_order?: number;
};

export type WebsiteCommitteeMemberPayload = {
  id?: number;
  name: string;
  designation?: string;
  photo_url?: string;
  phone?: string;
  is_published?: 0 | 1;
  sort_order?: number;
};

export type WebsiteAdmissionApplicationPayload = {
  student_name: string;
  father_name?: string;
  mother_name?: string;
  gender?: string;
  date_of_birth?: string;
  class_applied?: string;
  guardian_phone: string;
  address?: string;
  note?: string;
};

export type WebsiteAdmissionApplication = WebsiteAdmissionApplicationPayload & {
  id: number;
  status: "pending" | "approved" | "rejected";
  created_at: string;
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
  const res = await cachedGet(`/website/public/${slug}`);
  return res.data.data;
}

export async function getWebsiteSettings(madrasaId?: number) {
  const res = await cachedGet("/website/admin/settings", {
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

export async function saveWebsiteSlide(payload: WebsiteSlidePayload) {
  const res = await api.post("/website/admin/slides", payload);
  return res.data;
}

export async function deleteWebsiteSlide(id: number) {
  const res = await api.delete(`/website/admin/slides/${id}`);
  return res.data;
}

export async function saveWebsiteCommitteeMember(payload: WebsiteCommitteeMemberPayload) {
  const res = await api.post("/website/admin/committee", payload);
  return res.data;
}

export async function deleteWebsiteCommitteeMember(id: number) {
  const res = await api.delete(`/website/admin/committee/${id}`);
  return res.data;
}

export async function submitAdmissionApplication(
  slug: string,
  payload: WebsiteAdmissionApplicationPayload,
) {
  const res = await api.post(`/website/public/${slug}/admission`, payload);
  return res.data;
}

/**
 * Full admission form (mirrors the admin admission form field set) - creates
 * a real PENDING student record for a Muhtamim to review, unlike
 * submitAdmissionApplication() above which only files a lightweight inquiry.
 */
export async function submitFullAdmissionApplication(slug: string, payload: Record<string, unknown>) {
  const res = await api.post(`/website/public/${slug}/admission-full`, payload);
  return res.data;
}

export async function updateAdmissionApplicationStatus(
  id: number,
  status: "pending" | "approved" | "rejected",
) {
  const res = await api.patch(`/website/admin/admissions/${id}/status`, { status });
  return res.data;
}

export async function deleteAdmissionApplication(id: number) {
  const res = await api.delete(`/website/admin/admissions/${id}`);
  return res.data;
}

export async function updateMadrasaWebsiteStatus(
  id: number,
  status: "active" | "limited" | "disabled",
) {
  const res = await adminApi.patch(`/website/super/madrasas/${id}/status`, { status });
  return res.data;
}
