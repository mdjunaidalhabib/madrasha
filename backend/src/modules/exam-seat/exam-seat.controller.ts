import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { TenantNotFoundInRequestError, BadRequestError } from "../../shared/errors";
import { examSeatService } from "./exam-seat.service";
import { t } from "../../shared/i18n";

const getMadrasaId = (req: Request): number => {
  const madrasaId = req.tenant?.madrasa_id;
  if (!madrasaId) throw new TenantNotFoundInRequestError();
  return Number(madrasaId);
};

export const getSeatAllocations = asyncHandler(async (req: Request, res: Response) => {
  const examRoutineId = Number(req.query.exam_routine_id);
  if (!examRoutineId) throw new BadRequestError(t({ bn: "exam_routine_id আবশ্যক", en: "exam_routine_id is required", ar: "exam_routine_id مطلوب" }));
  const data = await examSeatService.listByRoutine(getMadrasaId(req), examRoutineId);
  res.json({ success: true, data });
});

export const autoAllocateSeats = asyncHandler(async (req: Request, res: Response) => {
  const data = await examSeatService.autoAllocate(getMadrasaId(req), req.body);
  res.json({ success: true, message: t({ bn: "আসন বরাদ্দ সম্পন্ন হয়েছে", en: "Seats allocated successfully", ar: "تم توزيع المقاعد بنجاح" }), data });
});

export const manualAdjustSeat = asyncHandler(async (req: Request, res: Response) => {
  await examSeatService.manualAdjust(Number(req.params.id), getMadrasaId(req), req.body);
  return ApiResponse.message(res, t({ bn: "আসন আপডেট হয়েছে", en: "Seat updated successfully", ar: "تم تحديث المقعد بنجاح" }));
});

export const clearSeatAllocations = asyncHandler(async (req: Request, res: Response) => {
  const examRoutineId = Number(req.body.exam_routine_id);
  if (!examRoutineId) throw new BadRequestError(t({ bn: "exam_routine_id আবশ্যক", en: "exam_routine_id is required", ar: "exam_routine_id مطلوب" }));
  await examSeatService.clearByRoutine(getMadrasaId(req), examRoutineId);
  return ApiResponse.message(res, t({ bn: "আসন বরাদ্দ মুছে ফেলা হয়েছে", en: "Seat allocations cleared successfully", ar: "تم مسح توزيع المقاعد بنجاح" }));
});
