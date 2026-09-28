import { Request, Response } from "express";
import { ApiError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { logger } from "../../shared/logger/logger";
import { importantLinkService } from "./important-link.service";
import { t } from "../../shared/i18n";

const respondError = (res: Response, error: unknown, logTag: string, fallbackMessage: string) => {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  logger.error(logTag, error);
  return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: fallbackMessage });
};

export const listImportantLinks = async (_req: Request, res: Response) => {
  try {
    const data = await importantLinkService.list();
    res.json({ data });
  } catch (err) {
    respondError(res, err, "listImportantLinks ERROR:", "Failed to load important links");
  }
};

export const createImportantLink = async (req: Request, res: Response) => {
  try {
    const row = await importantLinkService.create(req.body);
    res.status(HttpStatus.CREATED).json({ message: t({ bn: "লিংক তৈরি হয়েছে", en: "Link created" }), id: row.id });
  } catch (err) {
    respondError(res, err, "createImportantLink ERROR:", "Failed to create important link");
  }
};

export const updateImportantLink = async (req: Request, res: Response) => {
  try {
    await importantLinkService.update(Number(req.params.id), req.body);
    res.json({ message: t({ bn: "লিংক আপডেট হয়েছে", en: "Link updated" }) });
  } catch (err) {
    respondError(res, err, "updateImportantLink ERROR:", "Failed to update important link");
  }
};

export const deleteImportantLink = async (req: Request, res: Response) => {
  try {
    await importantLinkService.delete(Number(req.params.id));
    res.json({ message: t({ bn: "লিংক মুছে ফেলা হয়েছে", en: "Link deleted" }) });
  } catch (err) {
    respondError(res, err, "deleteImportantLink ERROR:", "Failed to delete important link");
  }
};

export const reorderImportantLinks = async (req: Request, res: Response) => {
  try {
    const ids = (Array.isArray(req.body?.link_ids) ? req.body.link_ids : []).map(Number);
    await importantLinkService.reorder(ids);
    res.json({ message: t({ bn: "লিংকের ক্রম সংরক্ষণ করা হয়েছে", en: "Link order saved" }) });
  } catch (err) {
    respondError(res, err, "reorderImportantLinks ERROR:", "Failed to reorder important links");
  }
};
