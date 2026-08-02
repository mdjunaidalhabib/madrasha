import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { TenantNotResolvedError } from "../../shared/errors";
import { trashService } from "./trash.service";

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

/* ================= RESTORE ================= */

export const restoreStudent = asyncHandler(async (req: Request, res: Response) => {
  await trashService.restoreStudent(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, "Student restored successfully");
});

export const restoreTeacher = asyncHandler(async (req: Request, res: Response) => {
  await trashService.restoreTeacher(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, "Teacher restored successfully");
});

export const restoreExam = asyncHandler(async (req: Request, res: Response) => {
  await trashService.restoreExam(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, "Exam restored successfully");
});

/* ================= PERMANENT DELETE ================= */

export const permanentDeleteStudent = asyncHandler(async (req: Request, res: Response) => {
  await trashService.permanentDeleteStudent(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, "Student permanently deleted");
});

export const permanentDeleteTeacher = asyncHandler(async (req: Request, res: Response) => {
  await trashService.permanentDeleteTeacher(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, "Teacher permanently deleted");
});

export const permanentDeleteExam = asyncHandler(async (req: Request, res: Response) => {
  await trashService.permanentDeleteExam(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, "Exam permanently deleted");
});
