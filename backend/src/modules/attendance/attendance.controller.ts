import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { TenantNotFoundInRequestError } from "../../shared/errors";
import { attendanceService } from "./attendance.service";

const getMadrasaId = (req: Request): number => {
  const madrasaId = req.tenant?.madrasa_id;
  if (!madrasaId) throw new TenantNotFoundInRequestError();
  return Number(madrasaId);
};

export const bulkMarkAttendance = asyncHandler(async (req: Request, res: Response) => {
  const count = await attendanceService.bulkMark(getMadrasaId(req), req.user?.id, req.body);
  return ApiResponse.success(res, {
    message: "Attendance saved successfully",
    extra: { savedCount: count },
  });
});

export const getAttendance = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceService.list(getMadrasaId(req), req.query as any);
  res.json({ success: true, data });
});

export const getAttendanceSummary = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceService.summary(getMadrasaId(req), req.query as any);
  res.json({ success: true, data });
});
