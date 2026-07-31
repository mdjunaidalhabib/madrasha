import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { TenantNotFoundInRequestError } from "../../shared/errors";
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
