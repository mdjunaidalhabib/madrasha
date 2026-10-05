import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { TenantNotFoundInRequestError } from "../../shared/errors";
import { t } from "../../shared/i18n";
import { attendanceAnalyticsService } from "./attendance-analytics.service";

const getMadrasaId = (req: Request): number => {
  const madrasaId = req.tenant?.madrasa_id;
  if (!madrasaId) throw new TenantNotFoundInRequestError();
  return Number(madrasaId);
};

export const getOverview = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceAnalyticsService.overview(getMadrasaId(req), req.query as any);
  res.json({ success: true, data });
});

export const getTrend = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceAnalyticsService.trend(getMadrasaId(req), req.query as any);
  res.json({ success: true, data });
});

export const getLowAttendance = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceAnalyticsService.lowAttendance(getMadrasaId(req), req.query as any);
  res.json({ success: true, data });
});

export const getPayrollSummary = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceAnalyticsService.payrollSummary(getMadrasaId(req), req.query as any);
  res.json({ success: true, data });
});

export const applyPayrollDeductions = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceAnalyticsService.payrollApply(getMadrasaId(req), req.body || {});
  return ApiResponse.success(res, {
    data,
    message: t({ bn: "বেতনের কর্তন হালনাগাদ হয়েছে", en: "Payroll deductions updated" }),
  });
});
