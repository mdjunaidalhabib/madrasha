import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { HttpStatus } from "../../shared/constants";
import { staffService } from "./staff.service";

export const createStaff = asyncHandler(async (req: Request, res: Response) => {
  const madrasaId = req.tenant?.madrasa_id;
  const id = await staffService.createStaff(req.body, madrasaId);

  return ApiResponse.success(res, {
    message: "Staff created successfully",
    statusCode: HttpStatus.CREATED,
    extra: { id },
  });
});

export const getStaffList = asyncHandler(async (req: Request, res: Response) => {
  const madrasaId = req.tenant?.madrasa_id;
  const data = await staffService.listStaff(madrasaId);
  return ApiResponse.success(res, { data });
});

export const getStaffById = asyncHandler(async (req: Request, res: Response) => {
  const madrasaId = req.tenant?.madrasa_id;
  const data = await staffService.getStaffDetail(Number(req.params.id), madrasaId);
  return ApiResponse.success(res, { data });
});

export const updateStaff = asyncHandler(async (req: Request, res: Response) => {
  const madrasaId = req.tenant?.madrasa_id;
  const affectedRows = await staffService.updateStaff(Number(req.params.id), madrasaId, req.body);

  return ApiResponse.success(res, {
    message: "Staff updated successfully",
    extra: { affectedRows },
  });
});

export const deleteStaff = asyncHandler(async (req: Request, res: Response) => {
  const madrasaId = req.tenant?.madrasa_id;
  const affectedRows = await staffService.deleteStaff(Number(req.params.id), madrasaId);

  return ApiResponse.success(res, {
    message: "Staff deleted",
    extra: { affectedRows },
  });
});
