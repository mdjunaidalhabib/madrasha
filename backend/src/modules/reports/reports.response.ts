import { Request, Response } from "express";
import { logger } from "../../shared/logger/logger";
import { REPORT_LOAD_FAILED_MESSAGE, REPORT_TENANT_NOT_FOUND_MESSAGE } from "./reports.constants";
import { ReportResponse } from "./reports.types";

export const tenantId = (req: Request) => Number(req.tenant?.madrasa_id || 0);

export const ok = (res: Response, data: unknown[], warning?: string) =>
  res.json({ success: true, data, ...(warning ? { warning } : {}) });

export const fail = (res: Response, error: unknown) => {
  logger.error("REPORT ERROR:", error);
  return res.status(500).json({
    success: false,
    data: [],
    message: REPORT_LOAD_FAILED_MESSAGE,
  } satisfies ReportResponse);
};

export const requireTenant = (req: Request, res: Response): number => {
  const madrasaId = tenantId(req);

  if (!madrasaId) {
    res.status(400).json({ success: false, data: [], message: REPORT_TENANT_NOT_FOUND_MESSAGE });
    return 0;
  }

  return madrasaId;
};
