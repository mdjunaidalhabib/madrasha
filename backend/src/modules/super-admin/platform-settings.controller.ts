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

export const getPlatformSmsConfig = async (_req: Request, res: Response) => {
  try {
    const data = await platformSettingsService.getSmsConfig();
    res.json({ data });
  } catch (error) {
    respondError(res, error, "getPlatformSmsConfig ERROR:");
  }
};

export const savePlatformSmsConfig = async (req: Request, res: Response) => {
  try {
    await platformSettingsService.saveSmsConfig(req.body);
    res.json({ message: "SMS gateway config saved" });
  } catch (error) {
    respondError(res, error, "savePlatformSmsConfig ERROR:");
  }
};

export const deletePlatformSmsConfig = async (_req: Request, res: Response) => {
  try {
    await platformSettingsService.deleteSmsConfig();
    res.json({ message: "SMS gateway config removed" });
  } catch (error) {
    respondError(res, error, "deletePlatformSmsConfig ERROR:");
  }
};

export const checkPlatformSmsBalance = async (_req: Request, res: Response) => {
  try {
    const data = await platformSettingsService.checkSmsBalance();
    res.json({ data });
  } catch (error) {
    respondError(res, error, "checkPlatformSmsBalance ERROR:");
  }
};

export const getPlatformEmailConfig = async (_req: Request, res: Response) => {
  try {
    const data = await platformSettingsService.getEmailConfig();
    res.json({ data });
  } catch (error) {
    respondError(res, error, "getPlatformEmailConfig ERROR:");
  }
};

export const savePlatformEmailConfig = async (req: Request, res: Response) => {
  try {
    await platformSettingsService.saveEmailConfig(req.body);
    res.json({ message: "Email SMTP config saved" });
  } catch (error) {
    respondError(res, error, "savePlatformEmailConfig ERROR:");
  }
};

export const deletePlatformEmailConfig = async (_req: Request, res: Response) => {
  try {
    await platformSettingsService.deleteEmailConfig();
    res.json({ message: "Email SMTP config removed" });
  } catch (error) {
    respondError(res, error, "deletePlatformEmailConfig ERROR:");
  }
};

export const checkPlatformEmailConnection = async (_req: Request, res: Response) => {
  try {
    const data = await platformSettingsService.checkEmailConnection();
    res.json({ data });
  } catch (error) {
    respondError(res, error, "checkPlatformEmailConnection ERROR:");
  }
};
