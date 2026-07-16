import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { TenantNotFoundInRequestError } from "../../shared/errors";
import { examService } from "./exam.service";

const getMadrasaId = (req: Request): number => {
  const madrasaId = req.tenant?.madrasa_id;
  if (!madrasaId) throw new TenantNotFoundInRequestError();
  return Number(madrasaId);
};

/* ================= EXAMS ================= */

export const getExams = asyncHandler(async (req: Request, res: Response) => {
  const data = await examService.listExams(getMadrasaId(req));
  res.json(data);
});

export const createExam = asyncHandler(async (req: Request, res: Response) => {
  await examService.createExam(getMadrasaId(req), req.body);
  return ApiResponse.message(res, "Exam created successfully");
});

export const deleteExam = asyncHandler(async (req: Request, res: Response) => {
  await examService.deleteExam(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, "Exam deleted successfully");
});

/* ================= GENERAL GRADES ================= */

export const getGeneralGrades = asyncHandler(async (req: Request, res: Response) => {
  const data = await examService.listGeneralGrades(getMadrasaId(req));
  res.json(data);
});

export const saveGeneralGrade = asyncHandler(async (req: Request, res: Response) => {
  await examService.saveGeneralGrade(getMadrasaId(req), req.body);
  return ApiResponse.message(res, "General grade added successfully");
});

export const deleteGeneralGrade = asyncHandler(async (req: Request, res: Response) => {
  await examService.deleteGeneralGrade(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, "General grade deleted successfully");
});

/* ================= MADRASA GRADES ================= */

export const getMadrasaGrades = asyncHandler(async (req: Request, res: Response) => {
  const data = await examService.listMadrasaGrades(getMadrasaId(req));
  res.json(data);
});

export const saveMadrasaGrade = asyncHandler(async (req: Request, res: Response) => {
  await examService.saveMadrasaGrade(getMadrasaId(req), req.body);
  return ApiResponse.message(res, "Madrasa grade added successfully");
});

export const deleteMadrasaGrade = asyncHandler(async (req: Request, res: Response) => {
  await examService.deleteMadrasaGrade(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, "Madrasa grade deleted successfully");
});

/* ================= SETTINGS ================= */

export const getFailMark = asyncHandler(async (req: Request, res: Response) => {
  const value = await examService.getFailMark(getMadrasaId(req));
  res.json(value);
});

export const updateFailMark = asyncHandler(async (req: Request, res: Response) => {
  await examService.updateFailMark(getMadrasaId(req), req.body);
  return ApiResponse.message(res, "Fail mark updated successfully");
});
