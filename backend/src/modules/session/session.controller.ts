import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { TenantNotFoundInRequestError } from "../../shared/errors";
import { sessionService } from "./session.service";
import { t } from "../../shared/i18n";

const getMadrasaId = (req: Request): number => {
  const madrasaId = req.tenant?.madrasa_id;
  if (!madrasaId) throw new TenantNotFoundInRequestError();
  return Number(madrasaId);
};

export const getSessions = asyncHandler(async (req: Request, res: Response) => {
  const activeOnly = req.query.active_only === "true";
  const divisionId =
    req.query.division_id === undefined
      ? undefined
      : req.query.division_id === "" || req.query.division_id === "null"
        ? null
        : Number(req.query.division_id);
  const data = await sessionService.list(getMadrasaId(req), activeOnly, divisionId);
  res.json({ success: true, data });
});

export const createSession = asyncHandler(async (req: Request, res: Response) => {
  const data = await sessionService.create(getMadrasaId(req), req.body);
  return ApiResponse.success(res, { message: t({ bn: "সেশন তৈরি হয়েছে", en: "Session created successfully", ar: "تم إنشاء الجلسة بنجاح" }), data });
});

export const updateSession = asyncHandler(async (req: Request, res: Response) => {
  await sessionService.update(Number(req.params.id), getMadrasaId(req), req.body);
  return ApiResponse.message(res, t({ bn: "সেশন আপডেট হয়েছে", en: "Session updated successfully", ar: "تم تحديث العام الدراسي بنجاح" }));
});

export const setCurrentSession = asyncHandler(async (req: Request, res: Response) => {
  await sessionService.setCurrent(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, t({ bn: "চলতি সেশন আপডেট হয়েছে", en: "Current session updated successfully", ar: "تم تحديث العام الدراسي الحالي بنجاح" }));
});

export const deleteSession = asyncHandler(async (req: Request, res: Response) => {
  await sessionService.delete(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, t({ bn: "সেশন মুছে ফেলা হয়েছে", en: "Session deleted successfully", ar: "تم حذف العام الدراسي بنجاح" }));
});

export const deleteUnusedFeeStructures = asyncHandler(async (req: Request, res: Response) => {
  const count = await sessionService.deleteUnusedFeeStructures(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.success(res, { message: t({ bn: "ফি কাঠামোগুলো মুছে ফেলা হয়েছে", en: "Fee structures deleted", ar: "تم حذف هياكل الرسوم" }), data: { count } });
});
