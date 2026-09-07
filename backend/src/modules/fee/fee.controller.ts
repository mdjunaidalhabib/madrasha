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

// Backs the "যুক্ত পরীক্ষা" picker on the ফি কাঠামো form - gated on fee.read
// (not exam.read) so setting up an exam-linked fee never needs exam module
// access (see FeeRepository.findExamsForTenant).
export const getFeeStructureExams = asyncHandler(async (req: Request, res: Response) => {
  const data = await feeService.listExamsForFeeLinking(getMadrasaId(req));
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

/* ================= ফি ধরণ ব্যবস্থাপনা (settings CRUD) ================= */

export const getFeeCategories = asyncHandler(async (req: Request, res: Response) => {
  const data = await feeService.getCategories(getMadrasaId(req));
  res.json({ success: true, data });
});

export const createFeeCategory = asyncHandler(async (req: Request, res: Response) => {
  await feeService.createCategory(getMadrasaId(req), req.body);
  return ApiResponse.message(res, "ফি ধরণ যোগ করা হয়েছে");
});

export const updateFeeCategory = asyncHandler(async (req: Request, res: Response) => {
  await feeService.updateCategory(Number(req.params.id), getMadrasaId(req), req.body);
  return ApiResponse.message(res, "ফি ধরণ আপডেট করা হয়েছে");
});

export const deleteFeeCategory = asyncHandler(async (req: Request, res: Response) => {
  await feeService.deleteCategory(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, "ফি ধরণ মুছে ফেলা হয়েছে");
});

/* ================= INVOICES ================= */

export const getInvoices = asyncHandler(async (req: Request, res: Response) => {
  const data = await feeService.listInvoices(getMadrasaId(req), req.query as any);
  res.json({ success: true, data });
});

export const getOverdueFees = asyncHandler(async (req: Request, res: Response) => {
  const data = await feeService.listOverdueFees(getMadrasaId(req), req.query as any);
  res.json({ success: true, data });
});

export const getPendingInvoices = asyncHandler(async (req: Request, res: Response) => {
  const data = await feeService.listPendingInvoices(getMadrasaId(req), req.query as any);
  res.json({ success: true, data });
});

export const getInvoiceSummary = asyncHandler(async (req: Request, res: Response) => {
  const data = await feeService.getDashboardSummary(getMadrasaId(req));
  res.json({ success: true, data });
});

export const clearPendingInvoices = asyncHandler(async (req: Request, res: Response) => {
  const data = await feeService.clearPendingInvoices(getMadrasaId(req));
  return ApiResponse.success(res, { message: "তালিকা ক্লিয়ার করা হয়েছে", data });
});

export const deleteAllInvoices = asyncHandler(async (req: Request, res: Response) => {
  const data = await feeService.deleteAllInvoices(getMadrasaId(req), req.body);
  return ApiResponse.success(res, { message: `${data.deleted} টি ইনভয়েস মুছে ফেলা হয়েছে`, data });
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
