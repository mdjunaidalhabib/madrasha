import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { BadRequestError } from "../../shared/errors";
import { uploadService, UploadTenant } from "./upload.service";
import { t } from "../../shared/i18n";

const requireTenant = (req: Request): UploadTenant => {
  const madrasaId = req.tenant?.madrasa_id;
  const slug = req.tenant?.slug;
  if (!madrasaId || !slug) throw new BadRequestError(t({ bn: "প্রতিষ্ঠানের তথ্য আবশ্যক", en: "Tenant context is required" }));
  return { madrasaId, slug };
};

export const uploadImage = asyncHandler(async (req: Request, res: Response) => {
  const data = await uploadService.uploadImage(requireTenant(req), req.body);
  return ApiResponse.success(res, {
    message: data.uploaded ? "Image uploaded successfully" : "Cloud storage not configured",
    data,
  });
});

export const deleteImage = asyncHandler(async (req: Request, res: Response) => {
  const data = await uploadService.deleteImage(requireTenant(req), req.body);
  return ApiResponse.success(res, { message: t({ bn: "প্রক্রিয়া সম্পন্ন হয়েছে", en: "Processed" }), data });
});
