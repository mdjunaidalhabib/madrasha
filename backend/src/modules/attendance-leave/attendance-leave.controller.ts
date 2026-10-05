import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { TenantNotFoundInRequestError, ValidationError } from "../../shared/errors";
import { t } from "../../shared/i18n";
import {
  approveLeaveSchema,
  cancelLeaveSchema,
  consecutiveQuerySchema,
  createLeaveSchema,
  listLeavesQuerySchema,
  parseDto as parse,
  rejectLeaveSchema,
} from "./attendance-leave.dto";
import { attendanceLeaveService } from "./attendance-leave.service";
import { attendanceAlertsService } from "./attendance-alerts.service";

const madrasaIdOf = (req: Request): number => {
  const id = req.tenant?.madrasa_id;
  if (!id) throw new TenantNotFoundInRequestError();
  return Number(id);
};

const userIdOf = (req: Request): number | null => (req.user?.id ? Number(req.user.id) : null);

const idParam = (req: Request): number => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ValidationError(t({ bn: "id সঠিক নয়", en: "id is invalid" }));
  return id;
};

export const listLeaves = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceLeaveService.list(madrasaIdOf(req), parse(listLeavesQuerySchema, req.query));
  return ApiResponse.success(res, { data });
});

export const getLeave = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceLeaveService.get(madrasaIdOf(req), idParam(req));
  return ApiResponse.success(res, { data });
});

export const createLeave = asyncHandler(async (req: Request, res: Response) => {
  const dto = parse(createLeaveSchema, req.body);
  const data = await attendanceLeaveService.create(madrasaIdOf(req), userIdOf(req), dto);
  return ApiResponse.success(res, {
    data,
    statusCode: 201,
    message: dto.approve_now
      ? t({ bn: "ছুটি মঞ্জুর করা হয়েছে", en: "Leave approved" })
      : t({ bn: "ছুটির আবেদন সংরক্ষণ করা হয়েছে", en: "Leave request saved" }),
  });
});

export const approveLeave = asyncHandler(async (req: Request, res: Response) => {
  const dto = parse(approveLeaveSchema, req.body);
  const data = await attendanceLeaveService.approve(madrasaIdOf(req), idParam(req), userIdOf(req), dto.note);
  return ApiResponse.success(res, { data, message: t({ bn: "ছুটি মঞ্জুর করা হয়েছে", en: "Leave approved" }) });
});

export const rejectLeave = asyncHandler(async (req: Request, res: Response) => {
  const dto = parse(rejectLeaveSchema, req.body);
  const data = await attendanceLeaveService.reject(madrasaIdOf(req), idParam(req), userIdOf(req), dto.note);
  return ApiResponse.success(res, { data, message: t({ bn: "ছুটির আবেদন প্রত্যাখ্যান করা হয়েছে", en: "Leave request rejected" }) });
});

export const cancelLeave = asyncHandler(async (req: Request, res: Response) => {
  const dto = parse(cancelLeaveSchema, req.body);
  const data = await attendanceLeaveService.cancel(madrasaIdOf(req), idParam(req), userIdOf(req), dto.note);
  return ApiResponse.success(res, { data, message: t({ bn: "ছুটি বাতিল করা হয়েছে", en: "Leave cancelled" }) });
});

export const getConsecutiveAlerts = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceAlertsService.consecutive(madrasaIdOf(req), parse(consecutiveQuerySchema, req.query));
  return ApiResponse.success(res, { data });
});
