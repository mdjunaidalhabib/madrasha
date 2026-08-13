import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { TenantNotFoundInRequestError } from "../../shared/errors";
import { feeService } from "./fee.service";

const getMadrasaId = (req: Request): number => {
  const madrasaId = req.tenant?.madrasa_id;
  if (!madrasaId) throw new TenantNotFoundInRequestError();
  return Number(madrasaId);
};

/* ================= FEE STRUCTURE ================= */

export const getFeeStructures = asyncHandler(async (req: Request, res: Response) => {
  const classId = req.query.class_id ? Number(req.query.class_id) : undefined;
  const sessionId = req.query.session_id ? Number(req.query.session_id) : undefined;
  const academicYear = req.query.academic_year ? String(req.query.academic_year) : undefined;
  const data = await feeService.listStructures(getMadrasaId(req), classId, sessionId, academicYear);
  res.json({ success: true, data });
});

export const createFeeStructure = asyncHandler(async (req: Request, res: Response) => {
  await feeService.createStructure(getMadrasaId(req), req.body);
  return ApiResponse.message(res, "Fee structure created successfully");
});

export const updateFeeStructure = asyncHandler(async (req: Request, res: Response) => {
  await feeService.updateStructure(Number(req.params.id), getMadrasaId(req), req.body);
  return ApiResponse.message(res, "Fee structure updated successfully");
});

export const deleteFeeStructure = asyncHandler(async (req: Request, res: Response) => {
  await feeService.deleteStructure(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, "Fee structure deleted successfully");
});

/* ================= INVOICES ================= */

export const generateInvoices = asyncHandler(async (req: Request, res: Response) => {
  const data = await feeService.generateInvoices(getMadrasaId(req), req.body);
  return ApiResponse.success(res, { message: "Invoices generated successfully", data });
});

export const getInvoices = asyncHandler(async (req: Request, res: Response) => {
  const data = await feeService.listInvoices(getMadrasaId(req), req.query as any);
  res.json({ success: true, data });
});

export const backfillInvoices = asyncHandler(async (req: Request, res: Response) => {
  const classId = req.body.class_id ? Number(req.body.class_id) : undefined;
  const sessionId = req.body.session_id ? Number(req.body.session_id) : undefined;
  const data = await feeService.backfillInvoicesForAllStudents(getMadrasaId(req), classId, sessionId);
  return ApiResponse.success(res, { message: "Invoices backfilled successfully", data });
});

export const payInvoice = asyncHandler(async (req: Request, res: Response) => {
  const data = await feeService.recordPayment(
    Number(req.params.id),
    getMadrasaId(req),
    req.user?.id,
    req.body,
  );
  return ApiResponse.success(res, { message: "Payment recorded successfully", data });
});

export const waiveInvoice = asyncHandler(async (req: Request, res: Response) => {
  const data = await feeService.waiveInvoice(
    Number(req.params.id),
    getMadrasaId(req),
    req.user?.id,
    req.body,
  );
  return ApiResponse.success(res, { message: "Invoice waived successfully", data });
});

/* ================= STUDENT ACCOUNT STATEMENT ================= */

export const getStudentStatement = asyncHandler(async (req: Request, res: Response) => {
  const data = await feeService.getStudentStatement(getMadrasaId(req), Number(req.params.id));
  res.json({ success: true, data });
});

/* ================= MANUAL PAYMENT METHOD SETUP ================= */

export const getPaymentMethodSettings = asyncHandler(async (req: Request, res: Response) => {
  const activeOnly = req.query.active_only === "true";
  const data = await feeService.listPaymentMethodSettings(getMadrasaId(req), activeOnly);
  res.json({ success: true, data });
});

export const createPaymentMethodSetting = asyncHandler(async (req: Request, res: Response) => {
  await feeService.createPaymentMethodSetting(getMadrasaId(req), req.body);
  return ApiResponse.message(res, "Payment method added successfully");
});

export const updatePaymentMethodSetting = asyncHandler(async (req: Request, res: Response) => {
  await feeService.updatePaymentMethodSetting(Number(req.params.id), getMadrasaId(req), req.body);
  return ApiResponse.message(res, "Payment method updated successfully");
});

export const deletePaymentMethodSetting = asyncHandler(async (req: Request, res: Response) => {
  await feeService.deletePaymentMethodSetting(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, "Payment method deleted successfully");
});
