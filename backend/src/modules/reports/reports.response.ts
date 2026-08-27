import { Request, Response } from "express";
import { logger } from "../../shared/logger/logger";
import { REPORT_LOAD_FAILED_MESSAGE, REPORT_TENANT_NOT_FOUND_MESSAGE } from "./reports.constants";
import { ReportResponse } from "./reports.types";

export const tenantId = (req: Request) => Number(req.tenant?.madrasa_id || 0);

export const ok = (res: Response, data: unknown[], warning?: string, total?: number) =>
  res.json({
    success: true,
    data,
    ...(warning ? { warning } : {}),
    ...(total !== undefined ? { total } : {}),
  });

export const fail = (res: Response, error: unknown) => {
  logger.error("REPORT ERROR:", error);
  return res.status(500).json({
    success: false,
    data: [],
    message: REPORT_LOAD_FAILED_MESSAGE,
  } satisfies ReportResponse);
};

const getOptionalPositiveInt = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

/** Reads division_id/class_id off req.query - shared by every report
 * controller that narrows a roster-shaped query down to one division/class
 * instead of always fetching every active student/teacher. */
export const getDivisionClassFilters = (req: Request) => ({
  divisionId: getOptionalPositiveInt(req.query.division_id),
  classId: getOptionalPositiveInt(req.query.class_id),
});

export const requireTenant = (req: Request, res: Response): number => {
  const madrasaId = tenantId(req);

  if (!madrasaId) {
    res.status(400).json({ success: false, data: [], message: REPORT_TENANT_NOT_FOUND_MESSAGE });
    return 0;
  }

  return madrasaId;
};
