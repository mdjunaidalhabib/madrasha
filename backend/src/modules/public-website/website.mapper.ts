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
    is_published: row.isPublished ?? 1,
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
