import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { TenantNotFoundInRequestError, BadRequestError } from "../../shared/errors";
import { examInvigilatorService } from "./exam-invigilator.service";
import { t } from "../../shared/i18n";

const getMadrasaId = (req: Request): number => {
  const madrasaId = req.tenant?.madrasa_id;
  if (!madrasaId) throw new TenantNotFoundInRequestError();
  return Number(madrasaId);
};

export const getInvigilatorAssignments = asyncHandler(async (req: Request, res: Response) => {
  const examRoutineId = Number(req.query.exam_routine_id);
  if (!examRoutineId) throw new BadRequestError(t({ bn: "exam_routine_id আবশ্যক", en: "exam_routine_id is required" }));
  const data = await examInvigilatorService.listByRoutine(getMadrasaId(req), examRoutineId);
  res.json({ success: true, data });
});

export const assignInvigilator = asyncHandler(async (req: Request, res: Response) => {
  await examInvigilatorService.assign(getMadrasaId(req), req.body);
  return ApiResponse.message(res, t({ bn: "পরিদর্শক নিয়োগ করা হয়েছে", en: "Invigilator assigned successfully" }));
});

export const updateInvigilatorStatus = asyncHandler(async (req: Request, res: Response) => {
  await examInvigilatorService.updateStatus(Number(req.params.id), getMadrasaId(req), req.body.status);
  return ApiResponse.message(res, t({ bn: "পরিদর্শক নিয়োগ আপডেট হয়েছে", en: "Invigilator assignment updated successfully" }));
});

export const removeInvigilatorAssignment = asyncHandler(async (req: Request, res: Response) => {
  await examInvigilatorService.remove(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, t({ bn: "পরিদর্শক নিয়োগ বাতিল করা হয়েছে", en: "Invigilator assignment removed successfully" }));
});
