import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { BadRequestError, TenantNotFoundInRequestError } from "../../shared/errors";
import { notificationService } from "./notification.service";

const getMadrasaId = (req: Request): number => {
  const madrasaId = req.tenant?.madrasa_id;
  if (!madrasaId) throw new TenantNotFoundInRequestError();
  return Number(madrasaId);
};

export const sendNotification = asyncHandler(async (req: Request, res: Response) => {
  const data = await notificationService.send(getMadrasaId(req), req.user?.id, req.body);
  return ApiResponse.success(res, { message: "Notification(s) processed", data });
});

export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const data = await notificationService.list(getMadrasaId(req), req.query as any);
  res.json({ success: true, data });
});

export const getAudienceStudents = asyncHandler(async (req: Request, res: Response) => {
  const data = await notificationService.getAudienceStudents(getMadrasaId(req), req.query as any);
  return ApiResponse.success(res, { data });
});

export const getAudienceTeachers = asyncHandler(async (req: Request, res: Response) => {
  const data = await notificationService.getAudienceTeachers(getMadrasaId(req));
  return ApiResponse.success(res, { data });
});

export const getAudienceResults = asyncHandler(async (req: Request, res: Response) => {
  const examId = Number(req.query.examId);
  const classId = Number(req.query.classId);
  const data = await notificationService.getAudienceResults(getMadrasaId(req), examId, classId);
  return ApiResponse.success(res, { data });
});

export const getNotificationSettings = asyncHandler(async (req: Request, res: Response) => {
  const data = await notificationService.getSettings(getMadrasaId(req));
  return ApiResponse.success(res, { data });
});

export const updateNotificationSetting = asyncHandler(async (req: Request, res: Response) => {
  const data = await notificationService.updateSetting(
    getMadrasaId(req),
    req.params.eventKey,
    req.body,
  );
  return ApiResponse.success(res, { message: "Setting saved", data });
});

export const getNotificationBalance = asyncHandler(async (req: Request, res: Response) => {
  const channel = String(req.query.channel || "").toUpperCase();
  if (channel !== "SMS" && channel !== "EMAIL") {
    throw new BadRequestError("channel must be SMS or EMAIL");
  }
  const data = await notificationService.checkBalance(channel);
  return ApiResponse.success(res, { data });
});
