import { Request, Response } from "express";
import { ApiError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { settingsService } from "./settings.service";

const respondError = (res: Response, error: unknown) => {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: (error as Error)?.message });
};

export const getDivisions = asyncHandler(async (req: Request, res: Response) => {
  const madrasa_id = req.tenant!.madrasa_id;
  const data = await settingsService.listDivisions(madrasa_id);
  res.json(data);
});

export const getClassesByDivision = asyncHandler(async (req: Request, res: Response) => {
  const madrasa_id = req.tenant!.madrasa_id;
  const division_id = Number(req.params.division_id);
  const data = await settingsService.listClassesByDivision(madrasa_id, division_id);
  res.json(data);
});

export const getBranding = async (req: Request, res: Response) => {
  try {
    const madrasa_id = req.tenant!.madrasa_id;
    const data = await settingsService.getBranding(madrasa_id);
    res.json({ data });
  } catch (error) {
    respondError(res, error);
  }
};

export const updateBranding = async (req: Request, res: Response) => {
  try {
    const madrasa_id = req.tenant!.madrasa_id;
    await settingsService.updateBranding(madrasa_id, req.body);
    res.json({ message: "Branding saved successfully" });
  } catch (error) {
    respondError(res, error);
  }
};

export const deleteBrandingImage = async (req: Request, res: Response) => {
  try {
    const madrasa_id = req.tenant!.madrasa_id;
    const field = String(req.params.field || "");
    await settingsService.deleteBrandingImage(madrasa_id, field);
    res.json({ message: "Removed successfully" });
  } catch (error) {
    respondError(res, error);
  }
};

export const getDocumentTemplates = async (req: Request, res: Response) => {
  try {
    const madrasa_id = req.tenant!.madrasa_id;
    const data = await settingsService.getDocumentTemplates(madrasa_id);
    res.json({ data });
  } catch (error) {
    respondError(res, error);
  }
};

export const updateDocumentTemplates = async (req: Request, res: Response) => {
  try {
    const madrasa_id = req.tenant!.madrasa_id;
    await settingsService.updateDocumentTemplates(madrasa_id, req.body);
    res.json({ message: "টেমপ্লেট সেভ হয়েছে" });
  } catch (error) {
    respondError(res, error);
  }
};
