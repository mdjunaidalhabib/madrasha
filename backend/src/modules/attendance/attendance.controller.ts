import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { BadRequestError, TenantNotFoundInRequestError } from "../../shared/errors";
import { userHasPermission } from "../../shared/middleware/rbac.middleware";
import { attendanceService, AttendanceActor } from "./attendance.service";
import { t } from "../../shared/i18n";

const getMadrasaId = (req: Request): number => {
  const madrasaId = req.tenant?.madrasa_id;
  if (!madrasaId) throw new TenantNotFoundInRequestError();
  return Number(madrasaId);
};

/** Acting user + a memoized attendance.edit check (only queried when a rule needs it). */
const getActor = (req: Request): AttendanceActor => {
  let canEdit: Promise<boolean> | null = null;
  return {
    userId: req.user?.id ? Number(req.user.id) : null,
    canEdit: () => (canEdit ??= userHasPermission(req, "attendance.edit")),
  };
};

const getId = (req: Request): number => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new BadRequestError(t({ bn: "id সঠিক নয়", en: "id is invalid" }));
  return id;
};

export const bulkMarkAttendance = asyncHandler(async (req: Request, res: Response) => {
  const result = await attendanceService.bulkMark(getMadrasaId(req), getActor(req), req.body);
  return ApiResponse.success(res, {
    message: result.skipped.length
      ? t({
          bn: `হাজিরা সংরক্ষণ করা হয়েছে; ${result.skipped.length}টি ডিভাইস/ছুটির হাজিরা অপরিবর্তিত রাখা হয়েছে`,
          en: `Attendance saved; ${result.skipped.length} device/leave record(s) were left unchanged`,
        })
      : t({ bn: "হাজিরা সংরক্ষণ করা হয়েছে", en: "Attendance saved successfully" }),
    data: result,
    extra: result,
  });
});

export const correctAttendance = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceService.correct(getMadrasaId(req), getActor(req), getId(req), req.body);
  return ApiResponse.success(res, {
    message: t({ bn: "হাজিরা সংশোধন করা হয়েছে", en: "Attendance corrected" }),
    data,
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

export const getAttendanceStats = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceService.stats(getMadrasaId(req), req.query as any);
  res.json({ success: true, data });
});

export const getAttendanceHistory = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceService.history(getMadrasaId(req), req.query as any);
  res.json({ success: true, data });
});

export const getAttendanceRowHistory = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceService.rowHistory(getMadrasaId(req), getId(req));
  res.json({ success: true, data });
});

export const getAttendanceDayInfo = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceService.dayInfo(getMadrasaId(req), getActor(req), req.query.date as string | undefined);
  res.json({ success: true, data });
});

export const getAttendanceCalendar = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceService.calendar(getMadrasaId(req), req.query as any);
  res.json({ success: true, data });
});

export const getAttendancePolicy = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceService.getPolicy(getMadrasaId(req));
  res.json({ success: true, data });
});

export const updateAttendancePolicy = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceService.updatePolicy(getMadrasaId(req), req.body);
  return ApiResponse.success(res, {
    message: t({ bn: "হাজিরা নীতিমালা সংরক্ষণ করা হয়েছে", en: "Attendance policy saved" }),
    data,
  });
});
