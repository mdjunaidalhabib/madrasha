import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { TenantNotFoundInRequestError } from "../../shared/errors";
import { payrollService } from "./payroll.service";

const getMadrasaId = (req: Request): number => {
  const madrasaId = req.tenant?.madrasa_id;
  if (!madrasaId) throw new TenantNotFoundInRequestError();
  return Number(madrasaId);
};

export const generatePayroll = asyncHandler(async (req: Request, res: Response) => {
  const data = await payrollService.generate(getMadrasaId(req), req.body);
  return ApiResponse.success(res, { message: "Payroll generated successfully", data });
});

export const getPayroll = asyncHandler(async (req: Request, res: Response) => {
  const data = await payrollService.list(getMadrasaId(req), req.query as any);
  res.json({ success: true, data });
});

export const markPayrollPaid = asyncHandler(async (req: Request, res: Response) => {
  const data = await payrollService.markPaid(
    Number(req.params.id),
    getMadrasaId(req),
    req.user?.id,
    req.body,
  );
  return ApiResponse.success(res, { message: "Payroll marked as paid successfully", data });
});
