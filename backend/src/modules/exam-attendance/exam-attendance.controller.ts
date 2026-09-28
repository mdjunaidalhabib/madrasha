import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { TenantNotFoundInRequestError, BadRequestError } from "../../shared/errors";
import { examAttendanceService } from "./exam-attendance.service";
import { t } from "../../shared/i18n";

const getMadrasaId = (req: Request): number => {
  const madrasaId = req.tenant?.madrasa_id;
  if (!madrasaId) throw new TenantNotFoundInRequestError();
  return Number(madrasaId);
};

export const getExamAttendance = asyncHandler(async (req: Request, res: Response) => {
  const examRoutineId = Number(req.query.exam_routine_id);
  if (!examRoutineId) throw new BadRequestError(t({ bn: "exam_routine_id আবশ্যক", en: "exam_routine_id is required" }));
  const status = req.query.status ? String(req.query.status) : undefined;
  const search = req.query.search ? String(req.query.search) : undefined;
  const data = await examAttendanceService.listByRoutine(getMadrasaId(req), examRoutineId, status, search);
  res.json({ success: true, data });
});

export const bulkMarkExamAttendance = asyncHandler(async (req: Request, res: Response) => {
  const data = await examAttendanceService.bulkMark(getMadrasaId(req), req.user?.id ?? null, req.body);
  res.json({ success: true, message: t({ bn: "পরীক্ষার হাজিরা সংরক্ষণ করা হয়েছে", en: "Exam attendance marked successfully" }), data });
});

export const updateExamAttendance = asyncHandler(async (req: Request, res: Response) => {
  await examAttendanceService.updateOne(Number(req.params.id), getMadrasaId(req), req.body);
  return ApiResponse.message(res, t({ bn: "পরীক্ষার হাজিরা আপডেট হয়েছে", en: "Exam attendance updated successfully" }));
});

export const lockExamAttendance = asyncHandler(async (req: Request, res: Response) => {
  const examRoutineId = Number(req.body.exam_routine_id);
  if (!examRoutineId) throw new BadRequestError(t({ bn: "exam_routine_id আবশ্যক", en: "exam_routine_id is required" }));
  await examAttendanceService.lock(getMadrasaId(req), examRoutineId, req.user?.id ?? null);
  return ApiResponse.message(res, t({ bn: "পরীক্ষার হাজিরা লক করা হয়েছে", en: "Exam attendance locked successfully" }));
});

export const unlockExamAttendance = asyncHandler(async (req: Request, res: Response) => {
  const examRoutineId = Number(req.body.exam_routine_id);
  if (!examRoutineId) throw new BadRequestError(t({ bn: "exam_routine_id আবশ্যক", en: "exam_routine_id is required" }));
  await examAttendanceService.unlock(getMadrasaId(req), examRoutineId);
  return ApiResponse.message(res, t({ bn: "পরীক্ষার হাজিরা আনলক করা হয়েছে", en: "Exam attendance unlocked successfully" }));
});
