import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { TenantNotFoundInRequestError } from "../../shared/errors";
import { promotionService } from "./promotion.service";

const getMadrasaId = (req: Request): number => {
  const madrasaId = req.tenant?.madrasa_id;
  if (!madrasaId) throw new TenantNotFoundInRequestError();
  return Number(madrasaId);
};

export const previewPromotion = asyncHandler(async (req: Request, res: Response) => {
  const data = await promotionService.preview(getMadrasaId(req), req.body);
  res.json({ success: true, data });
});

export const executePromotion = asyncHandler(async (req: Request, res: Response) => {
  const data = await promotionService.execute(getMadrasaId(req), req.user?.id, req.body);
  return ApiResponse.success(res, { message: "Promotion completed successfully", data });
});
