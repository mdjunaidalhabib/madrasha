import { Request, Response } from "express";
import { ApiError, BadRequestError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { websiteService, resolveTenantId } from "./website.service";
import { normalizeHost } from "../../shared/utils/host.util";
import { t } from "../../shared/i18n";

const respondError = (res: Response, error: unknown) => {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: (error as Error)?.message });
};

export const getPublicWebsite = async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug || "").trim();
    const data = await websiteService.getPublicWebsite(slug);
    res.json({ data });
  } catch (error) {
    respondError(res, error);
  }
};

export const resolveDomain = async (req: Request, res: Response) => {
  try {
    const host = normalizeHost(req.headers.host);
    if (!host) throw new BadRequestError(t({ bn: "Host হেডার আবশ্যক", en: "Host header required" }));

    const data = await websiteService.resolveDomainToSlug(host);
    res.json({ data });
  } catch (error) {
    respondError(res, error);
  }
};

export const getWebsiteSettings = async (req: Request, res: Response) => {
  try {
    const madrasaId = resolveTenantId(req);
    if (!madrasaId) throw new BadRequestError(t({ bn: "madrasa_id আবশ্যক", en: "madrasa_id required" }));

    const data = await websiteService.getWebsiteSettings(madrasaId);
    res.json({ data });
  } catch (error) {
    respondError(res, error);
  }
};

export const upsertWebsiteSettings = async (req: Request, res: Response) => {
  try {
    const madrasaId = resolveTenantId(req);
    if (!madrasaId) throw new BadRequestError(t({ bn: "madrasa_id আবশ্যক", en: "madrasa_id required" }));

    await websiteService.upsertWebsiteSettings(madrasaId, req.body);
    res.json({ message: t({ bn: "ওয়েবসাইট সেটিংস সংরক্ষণ হয়েছে", en: "Website settings saved" }) });
  } catch (error) {
    respondError(res, error);
  }
};

export const upsertWebsitePage = async (req: Request, res: Response) => {
  try {
    const madrasaId = resolveTenantId(req);
    if (!madrasaId) throw new BadRequestError(t({ bn: "madrasa_id আবশ্যক", en: "madrasa_id required" }));

    await websiteService.upsertWebsitePage(madrasaId, req.body);
    res.json({ message: t({ bn: "ওয়েবসাইট পেজ সংরক্ষণ হয়েছে", en: "Website page saved" }) });
  } catch (error) {
    respondError(res, error);
  }
};

export const saveWebsiteNotice = async (req: Request, res: Response) => {
  try {
    const madrasaId = resolveTenantId(req);
    if (!madrasaId) throw new BadRequestError(t({ bn: "madrasa_id আবশ্যক", en: "madrasa_id required" }));

    const latest = await websiteService.saveWebsiteNotice(madrasaId, req.body);
    res.json({ message: t({ bn: "নোটিশ সংরক্ষণ হয়েছে", en: "Notice saved" }), data: latest });
  } catch (error) {
    respondError(res, error);
  }
};

export const deleteWebsiteNotice = async (req: Request, res: Response) => {
  try {
    const madrasaId = resolveTenantId(req);
    const id = Number(req.params.id);
    if (!madrasaId || !id) throw new BadRequestError(t({ bn: "অনুরোধটি সঠিক নয়", en: "Invalid request" }));

    await websiteService.deleteWebsiteNotice(madrasaId, id);
    res.json({ message: t({ bn: "নোটিশ মুছে ফেলা হয়েছে", en: "Notice deleted" }) });
  } catch (error) {
    respondError(res, error);
  }
};

export const saveWebsiteGalleryItem = async (req: Request, res: Response) => {
  try {
    const madrasaId = resolveTenantId(req);
    if (!madrasaId) throw new BadRequestError(t({ bn: "madrasa_id আবশ্যক", en: "madrasa_id required" }));

    const latest = await websiteService.saveWebsiteGalleryItem(madrasaId, req.body);
    res.json({ message: t({ bn: "গ্যালারি আইটেম সংরক্ষণ হয়েছে", en: "Gallery item saved" }), data: latest });
  } catch (error) {
    respondError(res, error);
  }
};

export const deleteWebsiteGalleryItem = async (req: Request, res: Response) => {
  try {
    const madrasaId = resolveTenantId(req);
    const id = Number(req.params.id);
    if (!madrasaId || !id) throw new BadRequestError(t({ bn: "অনুরোধটি সঠিক নয়", en: "Invalid request" }));

    await websiteService.deleteWebsiteGalleryItem(madrasaId, id);
    res.json({ message: t({ bn: "গ্যালারি আইটেম মুছে ফেলা হয়েছে", en: "Gallery item deleted" }) });
  } catch (error) {
    respondError(res, error);
  }
};

export const saveWebsiteVideo = async (req: Request, res: Response) => {
  try {
    const madrasaId = resolveTenantId(req);
    if (!madrasaId) throw new BadRequestError(t({ bn: "madrasa_id আবশ্যক", en: "madrasa_id required" }));

    const latest = await websiteService.saveWebsiteVideo(madrasaId, req.body);
    res.json({ message: t({ bn: "ভিডিও সংরক্ষণ হয়েছে", en: "Video saved" }), data: latest });
  } catch (error) {
    respondError(res, error);
  }
};

export const deleteWebsiteVideo = async (req: Request, res: Response) => {
  try {
    const madrasaId = resolveTenantId(req);
    const id = Number(req.params.id);
    if (!madrasaId || !id) throw new BadRequestError(t({ bn: "অনুরোধটি সঠিক নয়", en: "Invalid request" }));

    await websiteService.deleteWebsiteVideo(madrasaId, id);
    res.json({ message: t({ bn: "ভিডিও মুছে ফেলা হয়েছে", en: "Video deleted" }) });
  } catch (error) {
    respondError(res, error);
  }
};

export const saveWebsiteSlide = async (req: Request, res: Response) => {
  try {
    const madrasaId = resolveTenantId(req);
    if (!madrasaId) throw new BadRequestError(t({ bn: "madrasa_id আবশ্যক", en: "madrasa_id required" }));

    const latest = await websiteService.saveWebsiteSlide(madrasaId, req.body);
    res.json({ message: t({ bn: "স্লাইড সংরক্ষণ হয়েছে", en: "Slide saved" }), data: latest });
  } catch (error) {
    respondError(res, error);
  }
};

export const deleteWebsiteSlide = async (req: Request, res: Response) => {
  try {
    const madrasaId = resolveTenantId(req);
    const id = Number(req.params.id);
    if (!madrasaId || !id) throw new BadRequestError(t({ bn: "অনুরোধটি সঠিক নয়", en: "Invalid request" }));

    await websiteService.deleteWebsiteSlide(madrasaId, id);
    res.json({ message: t({ bn: "স্লাইড মুছে ফেলা হয়েছে", en: "Slide deleted" }) });
  } catch (error) {
    respondError(res, error);
  }
};

export const saveWebsiteCommitteeMember = async (req: Request, res: Response) => {
  try {
    const madrasaId = resolveTenantId(req);
    if (!madrasaId) throw new BadRequestError(t({ bn: "madrasa_id আবশ্যক", en: "madrasa_id required" }));

    const latest = await websiteService.saveWebsiteCommitteeMember(madrasaId, req.body);
    res.json({ message: t({ bn: "কমিটি সদস্য সংরক্ষণ হয়েছে", en: "Committee member saved" }), data: latest });
  } catch (error) {
    respondError(res, error);
  }
};

export const deleteWebsiteCommitteeMember = async (req: Request, res: Response) => {
  try {
    const madrasaId = resolveTenantId(req);
    const id = Number(req.params.id);
    if (!madrasaId || !id) throw new BadRequestError(t({ bn: "অনুরোধটি সঠিক নয়", en: "Invalid request" }));

    await websiteService.deleteWebsiteCommitteeMember(madrasaId, id);
    res.json({ message: t({ bn: "কমিটি সদস্য মুছে ফেলা হয়েছে", en: "Committee member deleted" }) });
  } catch (error) {
    respondError(res, error);
  }
};

export const submitAdmissionApplication = async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug || "").trim();
    const data = await websiteService.submitAdmissionApplication(slug, req.body);
    res.status(HttpStatus.CREATED).json({ message: t({ bn: "আবেদন জমা হয়েছে", en: "Application submitted" }), data });
  } catch (error) {
    respondError(res, error);
  }
};

export const submitFullAdmissionApplication = async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug || "").trim();
    const result = await websiteService.submitFullAdmissionApplication(slug, req.body);
    res.status(HttpStatus.CREATED).json({ message: t({ bn: "আবেদন জমা হয়েছে", en: "Application submitted" }), data: result });
  } catch (error) {
    respondError(res, error);
  }
};

export const updateAdmissionApplicationStatus = async (req: Request, res: Response) => {
  try {
    const madrasaId = resolveTenantId(req);
    const id = Number(req.params.id);
    if (!madrasaId || !id) throw new BadRequestError(t({ bn: "অনুরোধটি সঠিক নয়", en: "Invalid request" }));

    const status = await websiteService.updateAdmissionApplicationStatus(madrasaId, id, String(req.body.status || ""));
    res.json({ message: t({ bn: "আবেদনের অবস্থা আপডেট হয়েছে", en: "Application status updated" }), status });
  } catch (error) {
    respondError(res, error);
  }
};

export const deleteAdmissionApplication = async (req: Request, res: Response) => {
  try {
    const madrasaId = resolveTenantId(req);
    const id = Number(req.params.id);
    if (!madrasaId || !id) throw new BadRequestError(t({ bn: "অনুরোধটি সঠিক নয়", en: "Invalid request" }));

    await websiteService.deleteAdmissionApplication(madrasaId, id);
    res.json({ message: t({ bn: "আবেদন মুছে ফেলা হয়েছে", en: "Application deleted" }) });
  } catch (error) {
    respondError(res, error);
  }
};

export const updateWebsiteStatusBySuperAdmin = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const status = String(req.body.status || "");

    const savedStatus = await websiteService.updateWebsiteStatusBySuperAdmin(id, status);
    res.json({ message: t({ bn: "ওয়েবসাইটের অবস্থা আপডেট হয়েছে", en: "Website status updated" }), status: savedStatus });
  } catch (error) {
    respondError(res, error);
  }
};
