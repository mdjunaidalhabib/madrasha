import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { TenantNotResolvedError } from "../../shared/errors";
import { trashService } from "./trash.service";
import { t } from "../../shared/i18n";

const getMadrasaId = (req: Request): number => {
  const madrasaId = req.tenant?.madrasa_id;
  if (!madrasaId) throw new TenantNotResolvedError();
  return Number(madrasaId);
};

/* ================= LIST ================= */

export const getTrashedStudents = asyncHandler(async (req: Request, res: Response) => {
  const data = await trashService.listStudents(getMadrasaId(req));
  return ApiResponse.success(res, { data });
});

export const getTrashedTeachers = asyncHandler(async (req: Request, res: Response) => {
  const data = await trashService.listTeachers(getMadrasaId(req));
  return ApiResponse.success(res, { data });
});

export const getTrashedExams = asyncHandler(async (req: Request, res: Response) => {
  const data = await trashService.listExams(getMadrasaId(req));
  return ApiResponse.success(res, { data });
});

export const getTrashedDivisions = asyncHandler(async (req: Request, res: Response) => {
  const data = await trashService.listDivisions(getMadrasaId(req));
  return ApiResponse.success(res, { data });
});

export const getTrashedClasses = asyncHandler(async (req: Request, res: Response) => {
  const data = await trashService.listClasses(getMadrasaId(req));
  return ApiResponse.success(res, { data });
});

export const getTrashedBooks = asyncHandler(async (req: Request, res: Response) => {
  const data = await trashService.listBooks(getMadrasaId(req));
  return ApiResponse.success(res, { data });
});

export const getTrashedResults = asyncHandler(async (req: Request, res: Response) => {
  const data = await trashService.listResults(getMadrasaId(req));
  return ApiResponse.success(res, { data });
});

/* ================= RESTORE ================= */

export const restoreStudent = asyncHandler(async (req: Request, res: Response) => {
  await trashService.restoreStudent(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, t({ bn: "শিক্ষার্থী পুনরুদ্ধার করা হয়েছে", en: "Student restored successfully" }));
});

export const restoreTeacher = asyncHandler(async (req: Request, res: Response) => {
  await trashService.restoreTeacher(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, t({ bn: "শিক্ষক পুনরুদ্ধার করা হয়েছে", en: "Teacher restored successfully" }));
});

export const restoreExam = asyncHandler(async (req: Request, res: Response) => {
  await trashService.restoreExam(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, t({ bn: "পরীক্ষা পুনরুদ্ধার করা হয়েছে", en: "Exam restored successfully" }));
});

export const restoreDivision = asyncHandler(async (req: Request, res: Response) => {
  await trashService.restoreDivision(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, t({ bn: "বিভাগ পুনরুদ্ধার করা হয়েছে", en: "Division restored successfully" }));
});

export const restoreClass = asyncHandler(async (req: Request, res: Response) => {
  await trashService.restoreClass(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, t({ bn: "শ্রেণি পুনরুদ্ধার করা হয়েছে", en: "Class restored successfully" }));
});

export const restoreBook = asyncHandler(async (req: Request, res: Response) => {
  await trashService.restoreBook(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, t({ bn: "বিষয় পুনরুদ্ধার করা হয়েছে", en: "Subject restored successfully" }));
});

export const restoreResult = asyncHandler(async (req: Request, res: Response) => {
  await trashService.restoreResult(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, t({ bn: "ফলাফল পুনরুদ্ধার করা হয়েছে", en: "Result restored successfully" }));
});

/* ================= PERMANENT DELETE ================= */

export const permanentDeleteStudent = asyncHandler(async (req: Request, res: Response) => {
  await trashService.permanentDeleteStudent(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, t({ bn: "শিক্ষার্থী স্থায়ীভাবে মুছে ফেলা হয়েছে", en: "Student permanently deleted" }));
});

export const permanentDeleteTeacher = asyncHandler(async (req: Request, res: Response) => {
  await trashService.permanentDeleteTeacher(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, t({ bn: "শিক্ষক স্থায়ীভাবে মুছে ফেলা হয়েছে", en: "Teacher permanently deleted" }));
});

export const permanentDeleteExam = asyncHandler(async (req: Request, res: Response) => {
  await trashService.permanentDeleteExam(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, t({ bn: "পরীক্ষা স্থায়ীভাবে মুছে ফেলা হয়েছে", en: "Exam permanently deleted" }));
});

export const permanentDeleteDivision = asyncHandler(async (req: Request, res: Response) => {
  await trashService.permanentDeleteDivision(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, t({ bn: "বিভাগ স্থায়ীভাবে মুছে ফেলা হয়েছে", en: "Division permanently deleted" }));
});

export const permanentDeleteClass = asyncHandler(async (req: Request, res: Response) => {
  await trashService.permanentDeleteClass(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, t({ bn: "শ্রেণি স্থায়ীভাবে মুছে ফেলা হয়েছে", en: "Class permanently deleted" }));
});

export const permanentDeleteBook = asyncHandler(async (req: Request, res: Response) => {
  await trashService.permanentDeleteBook(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, t({ bn: "বিষয় স্থায়ীভাবে মুছে ফেলা হয়েছে", en: "Subject permanently deleted" }));
});

export const permanentDeleteResult = asyncHandler(async (req: Request, res: Response) => {
  await trashService.permanentDeleteResult(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, t({ bn: "ফলাফল স্থায়ীভাবে মুছে ফেলা হয়েছে", en: "Result permanently deleted" }));
});
