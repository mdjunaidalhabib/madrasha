import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { uploadService } from "./upload.service";

export const uploadImage = asyncHandler(async (req: Request, res: Response) => {
  const data = await uploadService.uploadImage(req.body);
  return ApiResponse.success(res, {
    message: data.uploaded ? "Image uploaded successfully" : "Cloud storage not configured",
    data,
  });
});

export const deleteImage = asyncHandler(async (req: Request, res: Response) => {
  const data = await uploadService.deleteImage(req.body);
  return ApiResponse.success(res, { message: "Processed", data });
});
