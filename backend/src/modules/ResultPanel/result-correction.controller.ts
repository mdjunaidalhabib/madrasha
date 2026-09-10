import { Request, Response } from "express";
import { ApiError, TenantNotFoundInRequestError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { logger } from "../../shared/logger/logger";
import { resultCorrectionService } from "./result-correction.service";

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

/* ================= REQUEST CORRECTION ================= */
export const requestCorrection = async (req: Request, res: Response) => {
  try {
    const madrasa_id = getMadrasaId(req);
    const result = await resultCorrectionService.requestCorrection(
      madrasa_id,
      req.user!.id,
      toNumber(req.params.resultMasterId),
      req.body,
    );
    res.json({ success: true, ...result });
  } catch (error) {
    respondError(res, error, "requestCorrection error:", "Failed to request correction");
  }
};

/* ================= LIST CORRECTIONS ================= */
export const listCorrections = async (req: Request, res: Response) => {
  try {
    const madrasa_id = getMadrasaId(req);
    const data = await resultCorrectionService.listCorrections(
      madrasa_id,
      toNumber(req.params.resultMasterId),
    );
    res.json({ success: true, data });
  } catch (error) {
    respondError(res, error, "listCorrections error:", "Failed to fetch corrections");
  }
};

/* ================= DECIDE CORRECTION ================= */
export const decideCorrection = async (req: Request, res: Response) => {
  try {
    const madrasa_id = getMadrasaId(req);
    const result = await resultCorrectionService.decide(
      madrasa_id,
      req.user!.id,
      toNumber(req.params.correctionId),
      Boolean(req.body?.approve),
      req.body?.decision_note,
    );
    res.json({ success: true, ...result });
  } catch (error) {
    respondError(res, error, "decideCorrection error:", "Failed to decide correction");
  }
};
