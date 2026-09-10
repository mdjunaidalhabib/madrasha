import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { TenantNotFoundInRequestError, BadRequestError } from "../../shared/errors";
import { examSeatService } from "./exam-seat.service";

const getMadrasaId = (req: Request): number => {
  const madrasaId = req.tenant?.madrasa_id;
  if (!madrasaId) throw new TenantNotFoundInRequestError();
  return Number(madrasaId);
};

export const getSeatAllocations = asyncHandler(async (req: Request, res: Response) => {
  const examRoutineId = Number(req.query.exam_routine_id);
  if (!examRoutineId) throw new BadRequestError("exam_routine_id is required");
  const data = await examSeatService.listByRoutine(getMadrasaId(req), examRoutineId);
  res.json({ success: true, data });
});

export const autoAllocateSeats = asyncHandler(async (req: Request, res: Response) => {
  const data = await examSeatService.autoAllocate(getMadrasaId(req), req.body);
  res.json({ success: true, message: "Seats allocated successfully", data });
});

export const manualAdjustSeat = asyncHandler(async (req: Request, res: Response) => {
  await examSeatService.manualAdjust(Number(req.params.id), getMadrasaId(req), req.body);
  return ApiResponse.message(res, "Seat updated successfully");
});

export const clearSeatAllocations = asyncHandler(async (req: Request, res: Response) => {
  const examRoutineId = Number(req.body.exam_routine_id);
  if (!examRoutineId) throw new BadRequestError("exam_routine_id is required");
  await examSeatService.clearByRoutine(getMadrasaId(req), examRoutineId);
  return ApiResponse.message(res, "Seat allocations cleared successfully");
});
