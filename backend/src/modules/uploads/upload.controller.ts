import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { BadRequestError } from "../../shared/errors";
import { uploadService } from "./upload.service";

export const uploadImage = asyncHandler(async (req: Request, res: Response) => {
  const madrasaId = req.tenant?.madrasa_id;
  if (!madrasaId) throw new BadRequestError("Tenant context is required");

  const data = await uploadService.uploadImage(madrasaId, req.body);
  return ApiResponse.success(res, {
    message: data.uploaded ? "Image uploaded successfully" : "Cloud storage not configured",
    data,
  });
});

export const deleteImage = asyncHandler(async (req: Request, res: Response) => {
  const madrasaId = req.tenant?.madrasa_id;
  if (!madrasaId) throw new BadRequestError("Tenant context is required");

  const data = await uploadService.deleteImage(madrasaId, req.body);
  return ApiResponse.success(res, { message: "Processed", data });
});
