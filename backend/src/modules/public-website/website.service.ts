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
  SubmitFullAdmissionRequestDto,
  SubmitWebsiteAdmissionApplicationRequestDto,
  UpsertWebsitePageRequestDto,
  UpsertWebsiteSettingsRequestDto,
} from "./website.dto";
import { DEFAULT_THEME_COLOR, VALID_ADMISSION_STATUSES, VALID_WEBSITE_STATUSES } from "./website.constants";
import {
  toMadrasaApiDto,
  toWebsiteAdmissionApplicationApiDto,
  toWebsiteCommitteeMemberApiDto,
  toWebsiteGalleryApiDto,
  toWebsiteNoticeApiDto,
  toWebsitePageApiDto,
  toWebsiteSettingsApiDto,
  toWebsiteSlideApiDto,
} from "./website.mapper";

export const resolveTenantId = (req: Request): number =>
  Number((req as any).tenant?.madrasa_id || req.body.madrasa_id || req.query.madrasa_id);

const boolValue = (value: unknown, fallback = 1) => {
  if (value === undefined || value === null || value === "") return fallback;
  return Number(value) ? 1 : 0;
};

export class WebsiteService {
  constructor(private readonly repository: WebsiteRepository = websiteRepository) {}

  async getPublicWebsite(slug: string) {
    const madrasa = await this.repository.findPublicMadrasaBySlug(slug);
    if (!madrasa) throw new NotFoundError("Madrasa not found");

    if (!madrasa.isActive || madrasa.websiteStatus === "disabled") {
      throw new ForbiddenError("This website is currently disabled");
    }

    const settings = await this.repository.findSettings(madrasa.id);
    if (settings?.isPublished === 0) {
      throw new ForbiddenError("This website is not published yet");
    }

    const [pages, notices, teachers, gallery, slides, committee, divisions] = await Promise.all([
      this.repository.findPublishedPages(madrasa.id),
      this.repository.findPublishedNotices(madrasa.id),
      this.repository.findTeachersOptional(madrasa.id),
      this.repository.findPublishedGallery(madrasa.id),
      this.repository.findPublishedSlides(madrasa.id),
      this.repository.findPublishedCommittee(madrasa.id),
      // Reused as-is from the admin class panel - madrasaId is passed
      // directly so no tenant-header auth is needed for this public route.
      classPanelService.listDivisions(madrasa.id),
    ]);

    const classesByDivision = await Promise.all(
      divisions.map((division) => classPanelService.listClasses(madrasa.id, division.division_id)),
    );
    const classes = classesByDivision.flat();

    return {
      madrasa: toMadrasaApiDto(madrasa),
      settings: toWebsiteSettingsApiDto(settings),
      pages: pages.map(toWebsitePageApiDto),
      notices: notices.map(toWebsiteNoticeApiDto),
      teachers,
      gallery: gallery.map(toWebsiteGalleryApiDto),
      slides: slides.map(toWebsiteSlideApiDto),
      committee: committee.map(toWebsiteCommitteeMemberApiDto),
      divisions,
      classes,
    };
  }

  async getWebsiteSettings(madrasaId: number) {
    const [madrasa, settings, pages, notices, gallery, slides, committee, admissions] = await Promise.all([
      this.repository.findMadrasaForAdmin(madrasaId),
      this.repository.findSettings(madrasaId),
      this.repository.findAllPages(madrasaId),
      this.repository.findAllNotices(madrasaId),
      this.repository.findAllGallery(madrasaId),
      this.repository.findAllSlides(madrasaId),
      this.repository.findAllCommittee(madrasaId),
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
      is_published,
      muhtamim_name,
      muhtamim_designation,
      muhtamim_photo,
      muhtamim_message,
      facebook_url,
      youtube_url,
      instagram_url,
      whatsapp_channel_url,
    } = body;

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
      isPublished: boolValue(is_published),
      muhtamimName: muhtamim_name || null,
      muhtamimDesignation: muhtamim_designation || null,
      muhtamimPhoto: muhtamim_photo || null,
      muhtamimMessage: muhtamim_message || null,
      facebookUrl: facebook_url || null,
      youtubeUrl: youtube_url || null,
      instagramUrl: instagram_url || null,
      whatsappChannelUrl: whatsapp_channel_url || null,
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

  async saveWebsiteSlide(madrasaId: number, body: SaveWebsiteSlideRequestDto) {
    const { id, title, subtitle, image_url, button_text, button_link, is_published = 1, sort_order = 0 } = body;
    if (!image_url) throw new BadRequestError("Slide image URL required");

    const shared = {
      title: title || null,
      subtitle: subtitle || null,
      imageUrl: image_url,
      buttonText: button_text || null,
      buttonLink: button_link || null,
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

  async submitAdmissionApplication(slug: string, body: SubmitWebsiteAdmissionApplicationRequestDto) {
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
    await this.repository.updateAdmissionApplicationStatus(id, madrasaId, status as WebsiteAdmissionStatus);
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
