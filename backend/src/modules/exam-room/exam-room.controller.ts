import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { TenantNotFoundInRequestError } from "../../shared/errors";
import { examRoomService } from "./exam-room.service";

const getMadrasaId = (req: Request): number => {
  const madrasaId = req.tenant?.madrasa_id;
  if (!madrasaId) throw new TenantNotFoundInRequestError();
  return Number(madrasaId);
};

export const getExamRooms = asyncHandler(async (req: Request, res: Response) => {
  const activeOnly = req.query.active_only === "true";
  const data = await examRoomService.listRooms(getMadrasaId(req), activeOnly);
  res.json({ success: true, data });
});

export const createExamRoom = asyncHandler(async (req: Request, res: Response) => {
  await examRoomService.createRoom(getMadrasaId(req), req.body);
  return ApiResponse.message(res, "Exam room added successfully");
});

export const updateExamRoom = asyncHandler(async (req: Request, res: Response) => {
  await examRoomService.updateRoom(Number(req.params.id), getMadrasaId(req), req.body);
  return ApiResponse.message(res, "Exam room updated successfully");
});

export const deactivateExamRoom = asyncHandler(async (req: Request, res: Response) => {
  await examRoomService.deactivateRoom(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, "Exam room deactivated successfully");
});
