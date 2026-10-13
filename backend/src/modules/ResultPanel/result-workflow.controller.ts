import { Request, Response } from "express";
import { ApiError, TenantNotFoundInRequestError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { logger } from "../../shared/logger/logger";
import { resultWorkflowService } from "./result-workflow.service";

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

/* ================= SUBMISSIONS (list) ================= */
export const getSubmissions = async (req: Request, res: Response) => {
  try {
    const madrasa_id = getMadrasaId(req);
    const data = await resultWorkflowService.getSubmissions(
      madrasa_id,
      toNumber(req.params.resultMasterId),
    );
    res.json({ success: true, data });
  } catch (error) {
    respondError(res, error, "getSubmissions error:", "Failed to fetch submissions");
  }
};

/* ================= SUBMIT BOOK ================= */
export const submitBook = async (req: Request, res: Response) => {
  try {
    const madrasa_id = getMadrasaId(req);
    const result = await resultWorkflowService.submitBook(
      madrasa_id,
      req.user!.id,
      toNumber(req.params.resultMasterId),
      toNumber(req.params.bookId),
    );
    res.json({ success: true, ...result });
  } catch (error) {
    respondError(res, error, "submitBook error:", "Failed to submit marks");
  }
};

/* ================= VERIFY BOOK ================= */
export const verifyBook = async (req: Request, res: Response) => {
  try {
    const madrasa_id = getMadrasaId(req);
    const result = await resultWorkflowService.verifyBook(
      madrasa_id,
      req.user!.id,
      toNumber(req.params.resultMasterId),
      toNumber(req.params.bookId),
      req.body?.comment,
    );
    res.json({ success: true, ...result });
  } catch (error) {
    respondError(res, error, "verifyBook error:", "Failed to verify marks");
  }
};

/* ================= REJECT BOOK ================= */
export const rejectBook = async (req: Request, res: Response) => {
  try {
    const madrasa_id = getMadrasaId(req);
    const result = await resultWorkflowService.rejectBook(
      madrasa_id,
      req.user!.id,
      toNumber(req.params.resultMasterId),
      toNumber(req.params.bookId),
      req.body?.reason,
    );
    res.json({ success: true, ...result });
  } catch (error) {
    respondError(res, error, "rejectBook error:", "Failed to reject marks");
  }
};

/* ================= UNPUBLISH ================= */
export const unpublishResult = async (req: Request, res: Response) => {
  try {
    const madrasa_id = getMadrasaId(req);
    const result = await resultWorkflowService.unpublish(
      madrasa_id,
      req.user!.id,
      toNumber(req.params.resultMasterId),
    );
    res.json({ success: true, ...result });
  } catch (error) {
    respondError(res, error, "unpublishResult error:", "Failed to unpublish result");
  }
};
