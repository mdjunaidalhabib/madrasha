import { Request } from "express";
import { WebsiteAdmissionStatus, WebsiteStatus } from "@prisma/client";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../shared/errors";
import { websiteRepository, WebsiteRepository } from "./website.repository";
import { studentService } from "../students/student.service";
import { classPanelService } from "../classPanal/class-panel.service";
import {
  SaveWebsiteCommitteeMemberRequestDto,
  SaveWebsiteGalleryItemRequestDto,
  SaveWebsiteNoticeRequestDto,
  SaveWebsiteSlideRequestDto,
  SaveWebsiteVideoRequestDto,
  SubmitFullAdmissionRequestDto,
  SubmitWebsiteAdmissionApplicationRequestDto,
  UpsertWebsitePageRequestDto,
  UpsertWebsiteSettingsRequestDto,
} from "./website.dto";
import {
  DEFAULT_THEME_COLOR,
  DEFAULT_WEBSITE_THEME,
  VALID_ADMISSION_STATUSES,
  VALID_WEBSITE_STATUSES,
  WEBSITE_THEME_KEYS,
} from "./website.constants";
import {
  toMadrasaApiDto,
  toWebsiteAdmissionApplicationApiDto,
  toWebsiteCommitteeMemberApiDto,
  toWebsiteGalleryApiDto,
  toWebsiteNoticeApiDto,
  toWebsitePageApiDto,
  toWebsiteSettingsApiDto,
  toWebsiteSlideApiDto,
  toWebsiteVideoApiDto,
} from "./website.mapper";

export const resolveTenantId = (req: Request): number =>
  Number((req as any).tenant?.madrasa_id || req.body.madrasa_id || req.query.madrasa_id);

const boolValue = (value: unknown, fallback = 1) => {
  if (value === undefined || value === null || value === "") return fallback;
  return Number(value) ? 1 : 0;
};

// Seconds for one full marquee loop - lower is faster. Clamped so a bad/
// missing value can't produce an unusably fast or frozen-looking scroll.
const NOTICE_BAR_SPEED_MIN = 5;
const NOTICE_BAR_SPEED_MAX = 60;
const NOTICE_BAR_SPEED_DEFAULT = 20;

const noticeBarSpeedValue = (value: unknown) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return NOTICE_BAR_SPEED_DEFAULT;
  return Math.min(NOTICE_BAR_SPEED_MAX, Math.max(NOTICE_BAR_SPEED_MIN, Math.round(num)));
};

// Slide click-through link. Only site-relative paths ("/admission", "#about")
// and http(s) URLs are kept - anything with another scheme (javascript:,
// data:, ...) is rejected since it's rendered as an href on the public site.
// A bare domain ("www.example.com/x") gets https:// prepended.
export const normalizeSlideLink = (value: unknown): string | null => {
  const link = typeof value === "string" ? value.trim() : "";
  if (!link) return null;
  if (link.length > 255) throw new BadRequestError("Slide link too long");
  if ((link.startsWith("/") && !link.startsWith("//")) || link.startsWith("#")) return link;
  if (/^https?:\/\//i.test(link)) return link;
  // "name:" not followed by a port digit = a URL scheme.
  if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(link) || link.startsWith("//")) {
    throw new BadRequestError("Slide link must be an http(s) URL or a site path");
  }
  const withScheme = `https://${link}`;
  if (withScheme.length > 255) throw new BadRequestError("Slide link too long");
  return withScheme;
};

export class WebsiteService {
  constructor(private readonly repository: WebsiteRepository = websiteRepository) {}

  async getPublicWebsite(slug: string) {
    const madrasa = await this.repository.findPublicMadrasaBySlug(slug);
    if (!madrasa) throw new NotFoundError("Madrasa not found");

    if (!madrasa.isActive || madrasa.websiteStatus === "disabled") {
      throw new ForbiddenError("This website is currently disabled");
    }

    // Everything is fetched in one parallel round - the DB is remote, so each
    // sequential await used to add a full network round-trip to page load.
    const [
      settings,
      pages,
      notices,
      teachers,
      gallery,
      slides,
      committee,
      videos,
      divisionsWithClasses,
    ] = await Promise.all([
      this.repository.findSettings(madrasa.id),
      this.repository.findPublishedPages(madrasa.id),
      this.repository.findPublishedNotices(madrasa.id),
      this.repository.findTeachersOptional(madrasa.id),
      this.repository.findPublishedGallery(madrasa.id),
      this.repository.findPublishedSlides(madrasa.id),
      this.repository.findPublishedCommittee(madrasa.id),
      this.repository.findPublishedVideos(madrasa.id),
      // Reused as-is from the admin class panel - madrasaId is passed
      // directly so no tenant-header auth is needed for this public route.
      classPanelService.listDivisions(madrasa.id).then(async (divisions) => ({
        divisions,
        classes: (
          await Promise.all(
            divisions.map((division) =>
              classPanelService.listClasses(madrasa.id, division.division_id),
            ),
          )
        ).flat(),
      })),
    ]);

    if (settings?.isPublished === 0) {
      throw new ForbiddenError("This website is not published yet");
    }
    const { divisions, classes } = divisionsWithClasses;

    return {
      madrasa: toMadrasaApiDto(madrasa),
      settings: toWebsiteSettingsApiDto(settings),
      pages: pages.map(toWebsitePageApiDto),
      notices: notices.map(toWebsiteNoticeApiDto),
      teachers,
      gallery: gallery.map(toWebsiteGalleryApiDto),
      slides: slides.map(toWebsiteSlideApiDto),
      committee: committee.map(toWebsiteCommitteeMemberApiDto),
      videos: videos.map(toWebsiteVideoApiDto),
      divisions,
      classes,
    };
  }

  /** Resolves the tenant slug for a visitor arriving on a madrasa's own
   * custom domain (root `/`, no slug in the URL) - the frontend calls this
   * once per page load when the hostname isn't the platform's own domain. */
  async resolveDomainToSlug(host: string) {
    const madrasa = await this.repository.findSlugByCustomDomain(host);
    if (!madrasa) throw new NotFoundError("No madrasa is connected to this domain");
    return { slug: madrasa.slug };
  }

  async getWebsiteSettings(madrasaId: number) {
    const [madrasa, settings, pages, notices, gallery, slides, committee, videos, admissions] =
      await Promise.all([
        this.repository.findMadrasaForAdmin(madrasaId),
        this.repository.findSettings(madrasaId),
        this.repository.findAllPages(madrasaId),
        this.repository.findAllNotices(madrasaId),
        this.repository.findAllGallery(madrasaId),
        this.repository.findAllSlides(madrasaId),
        this.repository.findAllCommittee(madrasaId),
        this.repository.findAllVideos(madrasaId),
        this.repository.findAllAdmissionApplications(madrasaId),
      ]);

    return {
      madrasa: toMadrasaApiDto(madrasa),
      settings: settings ? toWebsiteSettingsApiDto(settings) : null,
      pages: pages.map(toWebsitePageApiDto),
      notices: notices.map(toWebsiteNoticeApiDto),
      gallery: gallery.map(toWebsiteGalleryApiDto),
      slides: slides.map(toWebsiteSlideApiDto),
      committee: committee.map(toWebsiteCommitteeMemberApiDto),
      videos: videos.map(toWebsiteVideoApiDto),
      admissions: admissions.map(toWebsiteAdmissionApplicationApiDto),
    };
  }

  async upsertWebsiteSettings(madrasaId: number, body: UpsertWebsiteSettingsRequestDto) {
    const {
      name,
      phone,
      email,
      address,
      logo_url,
      hero_title,
      hero_subtitle,
      theme_color,
      theme_key,
      show_notices,
      show_gallery,
      show_teachers,
      show_admission,
      show_about,
      show_contact,
      show_slider,
      show_muhtamim,
      show_committee,
      show_notice_bar,
      notice_bar_text,
      notice_bar_speed,
      is_published,
      muhtamim_name,
      muhtamim_designation,
      muhtamim_photo,
      muhtamim_message,
      show_sovapoti,
      sovapoti_name,
      sovapoti_designation,
      sovapoti_photo,
      sovapoti_message,
      show_video_gallery,
      facebook_url,
      youtube_url,
      instagram_url,
      whatsapp_channel_url,
      map_url,
    } = body;

    const themeKey =
      theme_key === undefined || theme_key === null || theme_key === ""
        ? DEFAULT_WEBSITE_THEME
        : theme_key;
    if (
      typeof themeKey !== "string" ||
      !(WEBSITE_THEME_KEYS as readonly string[]).includes(themeKey)
    ) {
      throw new BadRequestError("Invalid theme");
    }

    await this.repository.updateMadrasaContactInfo(madrasaId, {
      ...(name ? { name } : {}),
      phone: phone || null,
      email: email || null,
      address: address || null,
    });

    const shared = {
      logoUrl: logo_url || null,
      heroTitle: hero_title || null,
      heroSubtitle: hero_subtitle || null,
      themeColor: theme_color || DEFAULT_THEME_COLOR,
      themeKey,
      showNotices: boolValue(show_notices),
      showGallery: boolValue(show_gallery),
      showTeachers: boolValue(show_teachers),
      showAdmission: boolValue(show_admission),
      showAbout: boolValue(show_about),
      showContact: boolValue(show_contact),
      showSlider: boolValue(show_slider),
      showMuhtamim: boolValue(show_muhtamim),
      showCommittee: boolValue(show_committee),
      showNoticeBar: boolValue(show_notice_bar),
      noticeBarText: notice_bar_text || null,
      noticeBarSpeed: noticeBarSpeedValue(notice_bar_speed),
      isPublished: boolValue(is_published),
      muhtamimName: muhtamim_name || null,
      muhtamimDesignation: muhtamim_designation || null,
      muhtamimPhoto: muhtamim_photo || null,
      muhtamimMessage: muhtamim_message || null,
      showSovapoti: boolValue(show_sovapoti),
      sovapotiName: sovapoti_name || null,
      sovapotiDesignation: sovapoti_designation || null,
      sovapotiPhoto: sovapoti_photo || null,
      sovapotiMessage: sovapoti_message || null,
      showVideoGallery: boolValue(show_video_gallery),
      facebookUrl: facebook_url || null,
      youtubeUrl: youtube_url || null,
      instagramUrl: instagram_url || null,
      whatsappChannelUrl: whatsapp_channel_url || null,
      mapUrl: map_url || null,
    };

    await this.repository.upsertSettings(madrasaId, shared, { madrasaId, ...shared });
  }

  async upsertWebsitePage(madrasaId: number, body: UpsertWebsitePageRequestDto) {
    const { page_key, title, content, is_published = 1, sort_order = 0 } = body;
    if (!page_key || !title) throw new BadRequestError("page_key and title required");

    const shared = {
      title,
      content: content || null,
      isPublished: boolValue(is_published),
      sortOrder: Number(sort_order) || 0,
    };

    await this.repository.upsertPage(madrasaId, page_key, shared, {
      madrasaId,
      pageKey: page_key,
      ...shared,
    });
  }

  async saveWebsiteNotice(madrasaId: number, body: SaveWebsiteNoticeRequestDto) {
    const { id, title, content, is_published = 1 } = body;
    if (!title) throw new BadRequestError("Notice title required");

    if (id) {
      await this.repository.updateNotice(Number(id), madrasaId, {
        title,
        content: content || null,
        isPublished: boolValue(is_published),
      });
    } else {
      await this.repository.createNotice({
        madrasaId,
        title,
        content: content || null,
        isPublished: boolValue(is_published),
      });
    }

    return this.repository.findLatestNotice(madrasaId);
  }

  async deleteWebsiteNotice(madrasaId: number, id: number) {
    await this.repository.deleteNotice(id, madrasaId);
  }

  async saveWebsiteGalleryItem(madrasaId: number, body: SaveWebsiteGalleryItemRequestDto) {
    const { id, title, image_url, is_published = 1, sort_order = 0 } = body;
    if (!image_url) throw new BadRequestError("Image URL required");

    if (id) {
      await this.repository.updateGalleryItem(Number(id), madrasaId, {
        title: title || null,
        imageUrl: image_url,
        isPublished: boolValue(is_published),
        sortOrder: Number(sort_order) || 0,
      });
    } else {
      await this.repository.createGalleryItem({
        madrasaId,
        title: title || null,
        imageUrl: image_url,
        isPublished: boolValue(is_published),
        sortOrder: Number(sort_order) || 0,
      });
    }

    return this.repository.findLatestGalleryItem(madrasaId);
  }

  async deleteWebsiteGalleryItem(madrasaId: number, id: number) {
    await this.repository.deleteGalleryItem(id, madrasaId);
  }

  async saveWebsiteVideo(madrasaId: number, body: SaveWebsiteVideoRequestDto) {
    const { id, title, video_url, is_published = 1, sort_order = 0 } = body;
    if (!video_url?.trim()) throw new BadRequestError("Video URL required");

    const shared = {
      title: title || null,
      videoUrl: video_url,
      isPublished: boolValue(is_published),
      sortOrder: Number(sort_order) || 0,
    };

    let videoId = Number(id) || 0;
    if (videoId) {
      await this.repository.updateVideo(videoId, madrasaId, shared);
    } else {
      const created = await this.repository.createVideo({ madrasaId, ...shared });
      videoId = created.id;
    }

    const saved = await this.repository.findVideoById(videoId, madrasaId);
    return saved ? toWebsiteVideoApiDto(saved) : null;
  }

  async deleteWebsiteVideo(madrasaId: number, id: number) {
    await this.repository.deleteVideo(id, madrasaId);
  }

  async saveWebsiteSlide(madrasaId: number, body: SaveWebsiteSlideRequestDto) {
    const { id, image_url, button_link, is_published = 1, sort_order = 0 } = body;
    if (!image_url) throw new BadRequestError("Slide image URL required");

    const shared = {
      imageUrl: image_url,
      buttonLink: normalizeSlideLink(button_link),
      isPublished: boolValue(is_published),
      sortOrder: Number(sort_order) || 0,
    };

    let slideId = Number(id) || 0;
    if (slideId) {
      await this.repository.updateSlide(slideId, madrasaId, shared);
    } else {
      const created = await this.repository.createSlide({ madrasaId, ...shared });
      slideId = created.id;
    }

    const saved = await this.repository.findSlideById(slideId, madrasaId);
    return saved ? toWebsiteSlideApiDto(saved) : null;
  }

  async deleteWebsiteSlide(madrasaId: number, id: number) {
    await this.repository.deleteSlide(id, madrasaId);
  }

  async saveWebsiteCommitteeMember(madrasaId: number, body: SaveWebsiteCommitteeMemberRequestDto) {
    const { id, name, designation, photo_url, phone, is_published = 1, sort_order = 0 } = body;
    if (!name?.trim()) throw new BadRequestError("Committee member name required");

    const shared = {
      name,
      designation: designation || null,
      photoUrl: photo_url || null,
      phone: phone || null,
      isPublished: boolValue(is_published),
      sortOrder: Number(sort_order) || 0,
    };

    let memberId = Number(id) || 0;
    if (memberId) {
      await this.repository.updateCommitteeMember(memberId, madrasaId, shared);
    } else {
      const created = await this.repository.createCommitteeMember({ madrasaId, ...shared });
      memberId = created.id;
    }

    const saved = await this.repository.findCommitteeMemberById(memberId, madrasaId);
    return saved ? toWebsiteCommitteeMemberApiDto(saved) : null;
  }

  async deleteWebsiteCommitteeMember(madrasaId: number, id: number) {
    await this.repository.deleteCommitteeMember(id, madrasaId);
  }

  async submitAdmissionApplication(
    slug: string,
    body: SubmitWebsiteAdmissionApplicationRequestDto,
  ) {
    const madrasa = await this.repository.findPublicMadrasaBySlug(slug);
    if (!madrasa) throw new NotFoundError("Madrasa not found");
    if (!madrasa.isActive || madrasa.websiteStatus === "disabled") {
      throw new ForbiddenError("This website is currently disabled");
    }

    const {
      student_name,
      father_name,
      mother_name,
      gender,
      date_of_birth,
      class_applied,
      guardian_phone,
      address,
      note,
    } = body;

    if (!student_name?.trim()) throw new BadRequestError("Student name required");
    if (!guardian_phone?.trim()) throw new BadRequestError("Guardian phone required");

    const created = await this.repository.createAdmissionApplication({
      madrasaId: madrasa.id,
      studentName: student_name.trim(),
      fatherName: father_name || null,
      motherName: mother_name || null,
      gender: gender || null,
      dateOfBirth: date_of_birth ? new Date(date_of_birth) : null,
      classApplied: class_applied || null,
      guardianPhone: guardian_phone.trim(),
      address: address || null,
      note: note || null,
    });

    return toWebsiteAdmissionApplicationApiDto(created);
  }

  /**
   * Full admission form submitted from the public website - mirrors the
   * admin admission form field set and creates a real (PENDING) `Student`
   * row via studentService.admitStudent (every admission lands PENDING now,
   * admin panel or public site alike), so a Muhtamim can review/approve it
   * through the same pending-admissions workflow as any other admission.
   */
  async submitFullAdmissionApplication(slug: string, body: SubmitFullAdmissionRequestDto) {
    const madrasa = await this.repository.findPublicMadrasaBySlug(slug);
    if (!madrasa) throw new NotFoundError("Madrasa not found");
    if (!madrasa.isActive || madrasa.websiteStatus === "disabled") {
      throw new ForbiddenError("This website is currently disabled");
    }

    return studentService.admitStudent(body as any, madrasa.id);
  }

  async updateAdmissionApplicationStatus(madrasaId: number, id: number, status: string) {
    if (!(VALID_ADMISSION_STATUSES as readonly string[]).includes(status)) {
      throw new BadRequestError("Invalid admission status");
    }
    await this.repository.updateAdmissionApplicationStatus(
      id,
      madrasaId,
      status as WebsiteAdmissionStatus,
    );
    return status;
  }

  async deleteAdmissionApplication(madrasaId: number, id: number) {
    await this.repository.deleteAdmissionApplication(id, madrasaId);
  }

  async updateWebsiteStatusBySuperAdmin(id: number, status: string) {
    if (!(VALID_WEBSITE_STATUSES as readonly string[]).includes(status)) {
      throw new BadRequestError("Invalid website status");
    }
    await this.repository.updateWebsiteStatus(id, status as WebsiteStatus);
    return status;
  }
}

export const websiteService = new WebsiteService();
