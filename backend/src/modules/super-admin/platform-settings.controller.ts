import { Request, Response } from "express";
import { ApiError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { logger } from "../../shared/logger/logger";
import { platformSettingsService } from "./platform-settings.service";

const respondError = (res: Response, error: unknown, logTag: string) => {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  logger.error(logTag, error);
  return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: (error as Error)?.message });
};

export const getPlatformCloudinaryConfig = async (_req: Request, res: Response) => {
  try {
    const data = await platformSettingsService.getCloudinaryConfig();
    res.json({ data });
  } catch (error) {
    respondError(res, error, "getPlatformCloudinaryConfig ERROR:");
  }
};

export const savePlatformCloudinaryConfig = async (req: Request, res: Response) => {
  try {
    await platformSettingsService.saveCloudinaryConfig(req.body);
    res.json({ message: "Cloudinary config saved" });
  } catch (error) {
    respondError(res, error, "savePlatformCloudinaryConfig ERROR:");
  }
};

export const deletePlatformCloudinaryConfig = async (_req: Request, res: Response) => {
  try {
    await platformSettingsService.deleteCloudinaryConfig();
    res.json({ message: "Cloudinary config removed" });
  } catch (error) {
    respondError(res, error, "deletePlatformCloudinaryConfig ERROR:");
  }
};
