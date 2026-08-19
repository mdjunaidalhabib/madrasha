import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { TenantNotFoundInRequestError } from "../../shared/errors";
import { kioskService } from "./kiosk.service";

const getMadrasaId = (req: Request): number => {
  const madrasaId = req.tenant?.madrasa_id;
  if (!madrasaId) throw new TenantNotFoundInRequestError();
  return Number(madrasaId);
};

export const scanCard = asyncHandler(async (req: Request, res: Response) => {
  const result = await kioskService.scanCard(getMadrasaId(req), req.body?.card_uid);
  return ApiResponse.success(res, {
    message: result.alreadyMarked ? "Attendance already marked today" : "Attendance marked",
    data: result,
  });
});

export const scanFingerprint = asyncHandler(async (req: Request, res: Response) => {
  const result = await kioskService.scanFingerprint(getMadrasaId(req), req.body?.fingerprint_id);
  return ApiResponse.success(res, {
    message: result.alreadyMarked ? "Attendance already marked today" : "Attendance marked",
    data: result,
  });
});

export const createDevice = asyncHandler(async (req: Request, res: Response) => {
  const result = await kioskService.createDevice(getMadrasaId(req), req.body?.name);
  return ApiResponse.success(res, {
    message: "Kiosk device created successfully",
    data: result,
    statusCode: 201,
  });
});

export const listDevices = asyncHandler(async (req: Request, res: Response) => {
  const data = await kioskService.listDevices(getMadrasaId(req));
  return ApiResponse.success(res, { data });
});

export const setDeviceActive = asyncHandler(async (req: Request, res: Response) => {
  await kioskService.setDeviceActive(getMadrasaId(req), Number(req.params.id), Boolean(req.body?.is_active));
  return ApiResponse.success(res, { message: "Kiosk device updated successfully" });
});

export const deleteDevice = asyncHandler(async (req: Request, res: Response) => {
  await kioskService.deleteDevice(getMadrasaId(req), Number(req.params.id));
  return ApiResponse.success(res, { message: "Kiosk device deleted successfully" });
});

export const assignStudentCard = asyncHandler(async (req: Request, res: Response) => {
  await kioskService.assignStudentCard(getMadrasaId(req), Number(req.params.id), req.body?.card_uid);
  return ApiResponse.success(res, { message: "Card assigned successfully" });
});
