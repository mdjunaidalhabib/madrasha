import { Request, Response } from "express";
import { ApiError, TenantNotFoundInRequestError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { logger } from "../../shared/logger/logger";
import { markComponentService } from "./mark-component.service";

const getMadrasaId = (req: Request): number => {
  const madrasaId = req.tenant?.madrasa_id;
  if (!madrasaId) throw new TenantNotFoundInRequestError();
  return Number(madrasaId);
};

const toNumber = (value: any, fallback = 0) => {
  const n = Number(value);
  return Number.isNaN(n) ? fallback : n;
};

const respondError = (res: Response, error: unknown, logTag: string, fallbackMessage: string) => {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }
  logger.error(logTag, error);
  return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: fallbackMessage });
};

export const getMarkComponents = async (req: Request, res: Response) => {
  try {
    const madrasa_id = getMadrasaId(req);
    const examId = req.query.exam_id ? toNumber(req.query.exam_id) : null;
    const data = await markComponentService.getComponents(madrasa_id, toNumber(req.query.book_id), examId);
    res.json({ success: true, ...data });
  } catch (error) {
    respondError(res, error, "getMarkComponents error:", "Failed to fetch mark components");
  }
};

export const saveMarkComponents = async (req: Request, res: Response) => {
  try {
    const madrasa_id = getMadrasaId(req);
    const result = await markComponentService.saveComponents(madrasa_id, req.user!.id, req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    respondError(res, error, "saveMarkComponents error:", "Failed to save mark components");
  }
};
