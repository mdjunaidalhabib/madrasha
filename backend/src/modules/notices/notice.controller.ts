import { Request, Response } from "express";
import { ApiError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { logger } from "../../shared/logger/logger";
import { TenantNotFoundInRequestError } from "../../shared/errors";
import { noticeService } from "./notice.service";

const getMadrasaId = (req: Request): number => {
  const madrasaId = req.tenant?.madrasa_id;
  if (!madrasaId) throw new TenantNotFoundInRequestError();
  return Number(madrasaId);
};

const respondError = (res: Response, error: unknown, logTag: string, fallbackMessage: string) => {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  logger.error(logTag, error);
  return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: fallbackMessage });
};

export const listNotices = async (req: Request, res: Response) => {
  try {
    const data = await noticeService.list(getMadrasaId(req));
    res.json({ data });
  } catch (err) {
    respondError(res, err, "listNotices ERROR:", "Failed to load notices");
  }
};

export const createNotice = async (req: Request, res: Response) => {
  try {
    const row = await noticeService.create(getMadrasaId(req), req.user?.id, req.body);
    res.status(HttpStatus.CREATED).json({ message: "নোটিশ তৈরি হয়েছে", data: row });
  } catch (err) {
    respondError(res, err, "createNotice ERROR:", "Failed to create notice");
  }
};

export const updateNotice = async (req: Request, res: Response) => {
  try {
    await noticeService.update(Number(req.params.id), getMadrasaId(req), req.body);
    res.json({ message: "নোটিশ আপডেট হয়েছে" });
  } catch (err) {
    respondError(res, err, "updateNotice ERROR:", "Failed to update notice");
  }
};

export const deleteNotice = async (req: Request, res: Response) => {
  try {
    await noticeService.delete(Number(req.params.id), getMadrasaId(req));
    res.json({ message: "নোটিশ মুছে ফেলা হয়েছে" });
  } catch (err) {
    respondError(res, err, "deleteNotice ERROR:", "Failed to delete notice");
  }
};
