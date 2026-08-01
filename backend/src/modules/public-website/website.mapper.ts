/**
 * Prisma returns website module rows in camelCase (themeColor, heroTitle,
 * isPublished, websiteStatus, ...), but every consumer - PublicWebsitePage
 * and AdminWebsiteSettingsPage - reads snake_case fields (theme_color,
 * hero_title, is_published, website_status, ...), matching the rest of the
 * API. Returning raw Prisma rows left every custom setting (theme color,
 * hero text, section toggles, publish state) silently undefined on both the
 * public site and the admin settings form after reload. Mirrors
 * teacher.mapper.ts / student.mapper.ts.
 */

export const toMadrasaApiDto = (row: Record<string, any> | null | undefined) => {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name ?? null,
    slug: row.slug ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    address: row.address ?? null,
    website_status: row.websiteStatus ?? "active",
  };
};

export const toWebsiteSettingsApiDto = (row: Record<string, any> | null | undefined) => {
  if (!row) return {};
  return {
    logo_url: row.logoUrl ?? null,
    hero_title: row.heroTitle ?? null,
    hero_subtitle: row.heroSubtitle ?? null,
    theme_color: row.themeColor ?? "#2563eb",
    show_notices: row.showNotices ?? 1,
    show_gallery: row.showGallery ?? 1,
    show_teachers: row.showTeachers ?? 1,
    show_admission: row.showAdmission ?? 1,
    show_about: row.showAbout ?? 1,
    show_contact: row.showContact ?? 1,
    show_slider: row.showSlider ?? 1,
    show_muhtamim: row.showMuhtamim ?? 1,
    show_committee: row.showCommittee ?? 1,
    show_notice_bar: row.showNoticeBar ?? 1,
    notice_bar_text: row.noticeBarText ?? null,
    is_published: row.isPublished ?? 1,
    muhtamim_name: row.muhtamimName ?? null,
    muhtamim_designation: row.muhtamimDesignation ?? null,
    muhtamim_photo: row.muhtamimPhoto ?? null,
    muhtamim_message: row.muhtamimMessage ?? null,
    facebook_url: row.facebookUrl ?? null,
    youtube_url: row.youtubeUrl ?? null,
    instagram_url: row.instagramUrl ?? null,
    whatsapp_channel_url: row.whatsappChannelUrl ?? null,
  };
};

export const toWebsitePageApiDto = (row: Record<string, any>) => ({
  page_key: row.pageKey,
  title: row.title,
  content: row.content ?? null,
  is_published: row.isPublished ?? 1,
  sort_order: row.sortOrder ?? 0,
});

export const toWebsiteNoticeApiDto = (row: Record<string, any>) => ({
  id: row.id,
  title: row.title,
  content: row.content ?? null,
  is_published: row.isPublished ?? 1,
  published_at: row.publishedAt ?? null,
});

export const toWebsiteGalleryApiDto = (row: Record<string, any>) => ({
  id: row.id,
  title: row.title ?? null,
  image_url: row.imageUrl,
  is_published: row.isPublished ?? 1,
  sort_order: row.sortOrder ?? 0,
});

export const toWebsiteSlideApiDto = (row: Record<string, any>) => ({
  id: row.id,
  title: row.title ?? null,
  subtitle: row.subtitle ?? null,
  image_url: row.imageUrl,
  button_text: row.buttonText ?? null,
  button_link: row.buttonLink ?? null,
  is_published: row.isPublished ?? 1,
  sort_order: row.sortOrder ?? 0,
});

export const toWebsiteCommitteeMemberApiDto = (row: Record<string, any>) => ({
  id: row.id,
  name: row.name,
  designation: row.designation ?? null,
  photo_url: row.photoUrl ?? null,
  phone: row.phone ?? null,
  is_published: row.isPublished ?? 1,
  sort_order: row.sortOrder ?? 0,
});

export const toWebsiteAdmissionApplicationApiDto = (row: Record<string, any>) => ({
  id: row.id,
  student_name: row.studentName,
  father_name: row.fatherName ?? null,
  mother_name: row.motherName ?? null,
  gender: row.gender ?? null,
  date_of_birth: row.dateOfBirth ?? null,
  class_applied: row.classApplied ?? null,
  guardian_phone: row.guardianPhone ?? null,
  address: row.address ?? null,
  note: row.note ?? null,
  status: row.status ?? "pending",
  created_at: row.createdAt ?? null,
});
