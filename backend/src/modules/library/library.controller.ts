import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { TenantNotFoundInRequestError } from "../../shared/errors";
import { libraryService } from "./library.service";

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
  return ApiResponse.message(res, "Category created successfully");
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  await libraryService.updateCategory(Number(req.params.id), getMadrasaId(req), req.body);
  return ApiResponse.message(res, "Category updated successfully");
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  await libraryService.deleteCategory(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, "Category deleted successfully");
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
  return ApiResponse.message(res, "Book added successfully");
});

export const updateBook = asyncHandler(async (req: Request, res: Response) => {
  await libraryService.updateBook(Number(req.params.id), getMadrasaId(req), req.body);
  return ApiResponse.message(res, "Book updated successfully");
});

export const deleteBook = asyncHandler(async (req: Request, res: Response) => {
  await libraryService.deleteBook(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, "Book deleted successfully");
});

/* ================= CIRCULATION ================= */

export const getBorrowRecords = asyncHandler(async (req: Request, res: Response) => {
  const data = await libraryService.listBorrowRecords(getMadrasaId(req), req.query as any);
  res.json({ success: true, data });
});

export const issueBook = asyncHandler(async (req: Request, res: Response) => {
  const data = await libraryService.issueBook(getMadrasaId(req), req.user?.id, req.body);
  return ApiResponse.success(res, { message: "Book issued successfully", data });
});

export const returnBook = asyncHandler(async (req: Request, res: Response) => {
  const data = await libraryService.returnBook(
    Number(req.params.id),
    getMadrasaId(req),
    req.user?.id,
    req.body,
  );
  return ApiResponse.success(res, { message: "Book returned successfully", data });
});

export const markBookLost = asyncHandler(async (req: Request, res: Response) => {
  const data = await libraryService.markLost(Number(req.params.id), getMadrasaId(req), req.body?.notes);
  return ApiResponse.success(res, { message: "Book marked as lost", data });
});

export const settleFine = asyncHandler(async (req: Request, res: Response) => {
  const data = await libraryService.settleFine(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.success(res, { message: "Fine settled successfully", data });
});

/* ================= SETTINGS ================= */

export const getFinePerDay = asyncHandler(async (req: Request, res: Response) => {
  const value = await libraryService.getFinePerDay(getMadrasaId(req));
  res.json({ success: true, data: { value } });
});

export const setFinePerDay = asyncHandler(async (req: Request, res: Response) => {
  await libraryService.setFinePerDay(getMadrasaId(req), req.body);
  return ApiResponse.message(res, "Fine rate updated successfully");
});
