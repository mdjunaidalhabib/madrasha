import { Request, Response } from "express";
import { ApiError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { logger } from "../../shared/logger/logger";
import { madrasaCleanService } from "./madrasa-clean.service";

const respondError = (res: Response, error: unknown, logTag?: string) => {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  if (logTag) logger.error(logTag, error);
  return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: (error as Error)?.message });
};

export const getMadrasaCleanStats = async (req: Request, res: Response) => {
  try {
    const stats = await madrasaCleanService.getCleanStats(Number(req.params.id));
    res.json({ data: stats });
  } catch (error) {
    respondError(res, error);
  }
};

export const cleanMadrasaData = async (req: Request, res: Response) => {
  try {
    const actingSuperAdminId = Number((req.user as any)?.id);
    await madrasaCleanService.cleanMadrasaData(Number(req.params.id), actingSuperAdminId, req.body);
    res.json({ message: "মাদ্রাসার ডেটা ক্লিন করা হয়েছে" });
  } catch (error) {
    respondError(res, error, "Clean madrasa data error:");
  }
};
