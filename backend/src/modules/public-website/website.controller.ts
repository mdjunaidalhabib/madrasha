import { Request, Response } from "express";
import { ApiError, BadRequestError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { websiteService, resolveTenantId } from "./website.service";

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

export const getWebsiteSettings = async (req: Request, res: Response) => {
  try {
    const madrasaId = resolveTenantId(req);
    if (!madrasaId) throw new BadRequestError("madrasa_id required");

    const data = await websiteService.getWebsiteSettings(madrasaId);
    res.json({ data });
  } catch (error) {
    respondError(res, error);
  }
};

export const upsertWebsiteSettings = async (req: Request, res: Response) => {
  try {
    const madrasaId = resolveTenantId(req);
    if (!madrasaId) throw new BadRequestError("madrasa_id required");

    await websiteService.upsertWebsiteSettings(madrasaId, req.body);
    res.json({ message: "Website settings saved" });
  } catch (error) {
    respondError(res, error);
  }
};

export const upsertWebsitePage = async (req: Request, res: Response) => {
  try {
    const madrasaId = resolveTenantId(req);
    if (!madrasaId) throw new BadRequestError("madrasa_id required");

    await websiteService.upsertWebsitePage(madrasaId, req.body);
    res.json({ message: "Website page saved" });
  } catch (error) {
    respondError(res, error);
  }
};

export const saveWebsiteNotice = async (req: Request, res: Response) => {
  try {
    const madrasaId = resolveTenantId(req);
    if (!madrasaId) throw new BadRequestError("madrasa_id required");

    const latest = await websiteService.saveWebsiteNotice(madrasaId, req.body);
    res.json({ message: "Notice saved", data: latest });
  } catch (error) {
    respondError(res, error);
  }
};

export const deleteWebsiteNotice = async (req: Request, res: Response) => {
  try {
    const madrasaId = resolveTenantId(req);
    const id = Number(req.params.id);
    if (!madrasaId || !id) throw new BadRequestError("Invalid request");

    await websiteService.deleteWebsiteNotice(madrasaId, id);
    res.json({ message: "Notice deleted" });
  } catch (error) {
    respondError(res, error);
  }
};

export const saveWebsiteGalleryItem = async (req: Request, res: Response) => {
  try {
    const madrasaId = resolveTenantId(req);
    if (!madrasaId) throw new BadRequestError("madrasa_id required");

    const latest = await websiteService.saveWebsiteGalleryItem(madrasaId, req.body);
    res.json({ message: "Gallery item saved", data: latest });
  } catch (error) {
    respondError(res, error);
  }
};

export const deleteWebsiteGalleryItem = async (req: Request, res: Response) => {
  try {
    const madrasaId = resolveTenantId(req);
    const id = Number(req.params.id);
    if (!madrasaId || !id) throw new BadRequestError("Invalid request");

    await websiteService.deleteWebsiteGalleryItem(madrasaId, id);
    res.json({ message: "Gallery item deleted" });
  } catch (error) {
    respondError(res, error);
  }
};

export const saveWebsiteSlide = async (req: Request, res: Response) => {
  try {
    const madrasaId = resolveTenantId(req);
    if (!madrasaId) throw new BadRequestError("madrasa_id required");

    const latest = await websiteService.saveWebsiteSlide(madrasaId, req.body);
    res.json({ message: "Slide saved", data: latest });
  } catch (error) {
    respondError(res, error);
  }
};

export const deleteWebsiteSlide = async (req: Request, res: Response) => {
  try {
    const madrasaId = resolveTenantId(req);
    const id = Number(req.params.id);
    if (!madrasaId || !id) throw new BadRequestError("Invalid request");

    await websiteService.deleteWebsiteSlide(madrasaId, id);
    res.json({ message: "Slide deleted" });
  } catch (error) {
    respondError(res, error);
  }
};

export const saveWebsiteCommitteeMember = async (req: Request, res: Response) => {
  try {
    const madrasaId = resolveTenantId(req);
    if (!madrasaId) throw new BadRequestError("madrasa_id required");

    const latest = await websiteService.saveWebsiteCommitteeMember(madrasaId, req.body);
    res.json({ message: "Committee member saved", data: latest });
  } catch (error) {
    respondError(res, error);
  }
};

export const deleteWebsiteCommitteeMember = async (req: Request, res: Response) => {
  try {
    const madrasaId = resolveTenantId(req);
    const id = Number(req.params.id);
    if (!madrasaId || !id) throw new BadRequestError("Invalid request");

    await websiteService.deleteWebsiteCommitteeMember(madrasaId, id);
    res.json({ message: "Committee member deleted" });
  } catch (error) {
    respondError(res, error);
  }
};

export const submitAdmissionApplication = async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug || "").trim();
    const data = await websiteService.submitAdmissionApplication(slug, req.body);
    res.status(HttpStatus.CREATED).json({ message: "Application submitted", data });
  } catch (error) {
    respondError(res, error);
  }
};

export const updateAdmissionApplicationStatus = async (req: Request, res: Response) => {
  try {
    const madrasaId = resolveTenantId(req);
    const id = Number(req.params.id);
    if (!madrasaId || !id) throw new BadRequestError("Invalid request");

    const status = await websiteService.updateAdmissionApplicationStatus(madrasaId, id, String(req.body.status || ""));
    res.json({ message: "Application status updated", status });
  } catch (error) {
    respondError(res, error);
  }
};

export const deleteAdmissionApplication = async (req: Request, res: Response) => {
  try {
    const madrasaId = resolveTenantId(req);
    const id = Number(req.params.id);
    if (!madrasaId || !id) throw new BadRequestError("Invalid request");

    await websiteService.deleteAdmissionApplication(madrasaId, id);
    res.json({ message: "Application deleted" });
  } catch (error) {
    respondError(res, error);
  }
};

export const updateWebsiteStatusBySuperAdmin = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const status = String(req.body.status || "");

    const savedStatus = await websiteService.updateWebsiteStatusBySuperAdmin(id, status);
    res.json({ message: "Website status updated", status: savedStatus });
  } catch (error) {
    respondError(res, error);
  }
};
