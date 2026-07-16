import { Request, Response } from "express";
import { ApiError, TenantNotFoundInRequestError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { logger } from "../../shared/logger/logger";
import { resultPanelService } from "./result-panel.service";

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

/* ================= CREATE SESSION ================= */
export const createSession = async (req: Request, res: Response) => {
  try {
    const madrasa_id = getMadrasaId(req);
    const result = await resultPanelService.createSession(
      madrasa_id,
      toNumber(req.body?.exam_id),
      toNumber(req.body?.class_id),
    );
    res.json({ success: true, ...result });
  } catch (error) {
    respondError(res, error, "createSession error:", "Failed to create session");
  }
};

/* ================= SAVE MARKS ================= */
export const saveMarks = async (req: Request, res: Response) => {
  try {
    const madrasa_id = getMadrasaId(req);
    const result = await resultPanelService.saveMarks(madrasa_id, req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    respondError(res, error, "saveMarks error:", "Failed to save marks");
  }
};

/* ================= GET MARKS ================= */
export const getMarks = async (req: Request, res: Response) => {
  try {
    const madrasa_id = getMadrasaId(req);
    const result = await resultPanelService.getMarks(
      madrasa_id,
      toNumber(req.query.exam_id),
      toNumber(req.query.class_id),
      toNumber(req.query.result_master_id),
    );
    res.json({ success: true, ...result });
  } catch (error) {
    respondError(res, error, "getMarks error:", "Failed to fetch marks");
  }
};

/* ================= PROCESS RESULT ================= */
export const processResult = async (req: Request, res: Response) => {
  try {
    const madrasa_id = getMadrasaId(req);
    const result = await resultPanelService.processResult(madrasa_id, req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    respondError(res, error, "processResult error:", "Failed to process result");
  }
};

/* ================= CLASS ENTRY STATUS ================= */
export const getClassStatus = async (req: Request, res: Response) => {
  try {
    const madrasa_id = getMadrasaId(req);
    const data = await resultPanelService.getClassStatus(
      madrasa_id,
      toNumber(req.query.exam_id),
      toNumber(req.query.division_id),
    );
    res.json({ success: true, data });
  } catch (error) {
    respondError(res, error, "getClassStatus error:", "Failed to fetch class status");
  }
};

/* ================= FULL OVERVIEW ================= */
export const getResultOverview = async (req: Request, res: Response) => {
  try {
    const madrasa_id = getMadrasaId(req);
    const result = await resultPanelService.getResultOverview(madrasa_id);
    res.json({ success: true, ...result });
  } catch (error) {
    respondError(res, error, "getResultOverview error:", "Failed to fetch result overview");
  }
};

/* ================= GET SUMMARY ================= */
export const getSummary = async (req: Request, res: Response) => {
  try {
    const madrasa_id = getMadrasaId(req);
    const data = await resultPanelService.getSummary(
      madrasa_id,
      toNumber(req.query.exam_id),
      toNumber(req.query.class_id),
    );
    res.json(data);
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    logger.error("getSummary error:", error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json([]);
  }
};

/* ================= PUBLISH ================= */
export const publishResult = async (req: Request, res: Response) => {
  try {
    const madrasa_id = getMadrasaId(req);
    const result = await resultPanelService.publishResult(madrasa_id, toNumber(req.body.result_master_id));
    res.json({ success: true, ...result });
  } catch (error) {
    respondError(res, error, "publishResult error:", "Failed to publish result");
  }
};

/* ================= DELETE RESULT ================= */
export const deleteResult = async (req: Request, res: Response) => {
  try {
    const madrasa_id = getMadrasaId(req);
    const result = await resultPanelService.deleteResult(madrasa_id, toNumber(req.params.id));
    res.json({ success: true, ...result });
  } catch (error) {
    respondError(res, error, "deleteResult error:", "Failed to delete result");
  }
};

/* ================= FULL RESULT VIEW ================= */
export const getFullResultView = async (req: Request, res: Response) => {
  try {
    const madrasa_id = getMadrasaId(req);
    const result = await resultPanelService.getFullResultView(
      madrasa_id,
      toNumber(req.query.exam_id),
      toNumber(req.query.class_id),
      toNumber(req.query.result_master_id),
    );
    res.status(HttpStatus.OK).json({ success: true, ...result });
  } catch (error) {
    respondError(res, error, "getFullResultView error:", "Failed to fetch full result view");
  }
};
