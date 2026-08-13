import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { TenantNotFoundInRequestError } from "../../shared/errors";
import { sessionService } from "./session.service";

const getMadrasaId = (req: Request): number => {
  const madrasaId = req.tenant?.madrasa_id;
  if (!madrasaId) throw new TenantNotFoundInRequestError();
  return Number(madrasaId);
};

export const getSessions = asyncHandler(async (req: Request, res: Response) => {
  const activeOnly = req.query.active_only === "true";
  const data = await sessionService.list(getMadrasaId(req), activeOnly);
  res.json({ success: true, data });
});

export const createSession = asyncHandler(async (req: Request, res: Response) => {
  const data = await sessionService.create(getMadrasaId(req), req.body);
  return ApiResponse.success(res, { message: "Session created successfully", data });
});

export const updateSession = asyncHandler(async (req: Request, res: Response) => {
  await sessionService.update(Number(req.params.id), getMadrasaId(req), req.body);
  return ApiResponse.message(res, "Session updated successfully");
});

export const setCurrentSession = asyncHandler(async (req: Request, res: Response) => {
  await sessionService.setCurrent(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, "Current session updated successfully");
});

export const deleteSession = asyncHandler(async (req: Request, res: Response) => {
  await sessionService.delete(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, "Session deleted successfully");
});
