import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { TenantNotFoundInRequestError } from "../../shared/errors";
import { libraryService } from "./library.service";
import { t } from "../../shared/i18n";

const getMadrasaId = (req: Request): number => {
  const madrasaId = req.tenant?.madrasa_id;
  if (!madrasaId) throw new TenantNotFoundInRequestError();
  return Number(madrasaId);
};

/* ================= CATEGORIES ================= */

export const getCategories = asyncHandler(async (req: Request, res: Response) => {
  const data = await libraryService.listCategories(getMadrasaId(req));
  res.json({ success: true, data });
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  await libraryService.createCategory(getMadrasaId(req), req.body);
  return ApiResponse.message(res, t({ bn: "ক্যাটাগরি তৈরি হয়েছে", en: "Category created successfully", ar: "تم إنشاء التصنيف بنجاح" }));
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  await libraryService.updateCategory(Number(req.params.id), getMadrasaId(req), req.body);
  return ApiResponse.message(res, t({ bn: "ক্যাটাগরি আপডেট হয়েছে", en: "Category updated successfully", ar: "تم تحديث التصنيف بنجاح" }));
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  await libraryService.deleteCategory(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, t({ bn: "ক্যাটাগরি মুছে ফেলা হয়েছে", en: "Category deleted successfully", ar: "تم حذف التصنيف بنجاح" }));
});

/* ================= BOOKS ================= */

export const getBooks = asyncHandler(async (req: Request, res: Response) => {
  const data = await libraryService.listBooks(getMadrasaId(req), req.query as any);
  res.json({ success: true, data });
});

export const getBook = asyncHandler(async (req: Request, res: Response) => {
  const data = await libraryService.getBook(Number(req.params.id), getMadrasaId(req));
  res.json({ success: true, data });
});

export const createBook = asyncHandler(async (req: Request, res: Response) => {
  await libraryService.createBook(getMadrasaId(req), req.body);
  return ApiResponse.message(res, t({ bn: "বই যোগ করা হয়েছে", en: "Book added successfully", ar: "تمت إضافة الكتاب بنجاح" }));
});

export const updateBook = asyncHandler(async (req: Request, res: Response) => {
  await libraryService.updateBook(Number(req.params.id), getMadrasaId(req), req.body);
  return ApiResponse.message(res, t({ bn: "বই আপডেট হয়েছে", en: "Book updated successfully", ar: "تم تحديث الكتاب بنجاح" }));
});

export const deleteBook = asyncHandler(async (req: Request, res: Response) => {
  await libraryService.deleteBook(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, t({ bn: "বই মুছে ফেলা হয়েছে", en: "Book deleted successfully", ar: "تم حذف الكتاب بنجاح" }));
});

/* ================= CIRCULATION ================= */

export const getBorrowRecords = asyncHandler(async (req: Request, res: Response) => {
  const data = await libraryService.listBorrowRecords(getMadrasaId(req), req.query as any);
  res.json({ success: true, data });
});

export const issueBook = asyncHandler(async (req: Request, res: Response) => {
  const data = await libraryService.issueBook(getMadrasaId(req), req.user?.id, req.body);
  return ApiResponse.success(res, { message: t({ bn: "বই ইস্যু করা হয়েছে", en: "Book issued successfully", ar: "تمت إعارة الكتاب بنجاح" }), data });
});

export const returnBook = asyncHandler(async (req: Request, res: Response) => {
  const data = await libraryService.returnBook(
    Number(req.params.id),
    getMadrasaId(req),
    req.user?.id,
    req.body,
  );
  return ApiResponse.success(res, { message: t({ bn: "বই ফেরত নেওয়া হয়েছে", en: "Book returned successfully", ar: "تمت إعادة الكتاب بنجاح" }), data });
});

export const markBookLost = asyncHandler(async (req: Request, res: Response) => {
  const data = await libraryService.markLost(Number(req.params.id), getMadrasaId(req), req.body?.notes);
  return ApiResponse.success(res, { message: t({ bn: "বই হারানো হিসেবে চিহ্নিত করা হয়েছে", en: "Book marked as lost", ar: "تم تسجيل الكتاب كمفقود" }), data });
});

export const settleFine = asyncHandler(async (req: Request, res: Response) => {
  const data = await libraryService.settleFine(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.success(res, { message: t({ bn: "জরিমানা নিষ্পত্তি হয়েছে", en: "Fine settled successfully", ar: "تمت تسوية الغرامة بنجاح" }), data });
});

/* ================= DASHBOARD SUMMARY ================= */

export const getLibraryDashboardSummary = asyncHandler(async (req: Request, res: Response) => {
  const data = await libraryService.getDashboardSummary(getMadrasaId(req));
  res.json({ success: true, data });
});

/* ================= SETTINGS ================= */

export const getFinePerDay = asyncHandler(async (req: Request, res: Response) => {
  const value = await libraryService.getFinePerDay(getMadrasaId(req));
  res.json({ success: true, data: { value } });
});

export const setFinePerDay = asyncHandler(async (req: Request, res: Response) => {
  await libraryService.setFinePerDay(getMadrasaId(req), req.body);
  return ApiResponse.message(res, t({ bn: "জরিমানার হার আপডেট হয়েছে", en: "Fine rate updated successfully", ar: "تم تحديث معدل الغرامة بنجاح" }));
});
