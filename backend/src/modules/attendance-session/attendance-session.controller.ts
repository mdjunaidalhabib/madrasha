import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { BadRequestError, TenantNotFoundInRequestError } from "../../shared/errors";
import { userHasPermission } from "../../shared/middleware/rbac.middleware";
import { t } from "../../shared/i18n";
import { attendanceSessionService, CanEditPast } from "./attendance-session.service";
import { parseBool } from "./attendance-session.rules";

const getMadrasaId = (req: Request): number => {
  const madrasaId = req.tenant?.madrasa_id;
  if (!madrasaId) throw new TenantNotFoundInRequestError();
  return Number(madrasaId);
};

const getId = (req: Request): number => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new BadRequestError(t({ bn: "আইডি সঠিক নয়", en: "Invalid id" }));
  return id;
};

/** Cached per request: attendance.edit is only looked up when a date is outside the window. */
const canEditPast = (req: Request): CanEditPast => {
  let cached: Promise<boolean> | null = null;
  return () => (cached ??= userHasPermission(req, "attendance.edit"));
};

export const listSessions = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceSessionService.list(getMadrasaId(req), req.query as any);
  res.json({ success: true, data });
});

export const createSession = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceSessionService.create(getMadrasaId(req), req.body || {});
  return ApiResponse.success(res, {
    statusCode: 201,
    data,
    message: t({ bn: "সেশন তৈরি হয়েছে", en: "Session created" }),
  });
});

export const updateSession = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceSessionService.update(getMadrasaId(req), getId(req), req.body || {});
  return ApiResponse.success(res, { data, message: t({ bn: "সেশন হালনাগাদ হয়েছে", en: "Session updated" }) });
});

export const deleteSession = asyncHandler(async (req: Request, res: Response) => {
  const force = parseBool(req.query.force) === true;
  const data = await attendanceSessionService.remove(getMadrasaId(req), getId(req), force);
  return ApiResponse.success(res, { data, message: t({ bn: "সেশন মুছে ফেলা হয়েছে", en: "Session deleted" }) });
});

export const getSessionSheet = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceSessionService.sheet(getMadrasaId(req), req.query as any, canEditPast(req));
  res.json({ success: true, data });
});

export const markSessionAttendance = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceSessionService.mark(getMadrasaId(req), req.user?.id, req.body || {}, canEditPast(req));
  return ApiResponse.success(res, {
    data,
    message: t({ bn: "সেশনের হাজিরা সংরক্ষণ করা হয়েছে", en: "Session attendance saved" }),
  });
});

export const getSessionReport = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceSessionService.report(getMadrasaId(req), req.query as any);
  res.json({ success: true, data });
});
