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
  const activeOnly = req.query.active_only === "true";
  // Optional বিভাগ filter: that division's exams + সকল বিভাগ exams.
  const data = await examService.listExams(getMadrasaId(req), activeOnly, req.query.division_id);
  res.json(data);
});

export const createExam = asyncHandler(async (req: Request, res: Response) => {
  await examService.createExam(getMadrasaId(req), req.body);
  return ApiResponse.message(res, "Exam created successfully");
});

export const updateExam = asyncHandler(async (req: Request, res: Response) => {
  // Switching a dormant exam on also activates its fee - those counts come back as data.
  const data = await examService.updateExam(Number(req.params.id), getMadrasaId(req), req.body);
  return data
    ? ApiResponse.success(res, { data, message: "Exam updated successfully" })
    : ApiResponse.message(res, "Exam updated successfully");
});

export const deleteExam = asyncHandler(async (req: Request, res: Response) => {
  await examService.deleteExam(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, "Exam deleted successfully");
});

export const reorderExams = asyncHandler(async (req: Request, res: Response) => {
  await examService.reorderExams(getMadrasaId(req), req.body?.ids);
  return ApiResponse.message(res, "Exam order updated successfully");
});

/* ================= GENERAL GRADES ================= */

export const getGeneralGrades = asyncHandler(async (req: Request, res: Response) => {
  const data = await examService.listGeneralGrades(getMadrasaId(req), req.query.division_id);
  res.json(data);
});

export const saveGeneralGrade = asyncHandler(async (req: Request, res: Response) => {
  await examService.saveGeneralGrade(getMadrasaId(req), req.body);
  return ApiResponse.message(res, "General grade added successfully");
});

export const updateGeneralGrade = asyncHandler(async (req: Request, res: Response) => {
  await examService.updateGeneralGrade(Number(req.params.id), getMadrasaId(req), req.body);
  return ApiResponse.message(res, "General grade updated successfully");
});

export const deleteGeneralGrade = asyncHandler(async (req: Request, res: Response) => {
  await examService.deleteGeneralGrade(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, "General grade deleted successfully");
});

/* ================= MADRASA GRADES ================= */

export const getMadrasaGrades = asyncHandler(async (req: Request, res: Response) => {
  const data = await examService.listMadrasaGrades(getMadrasaId(req), req.query.division_id);
  res.json(data);
});

export const saveMadrasaGrade = asyncHandler(async (req: Request, res: Response) => {
  await examService.saveMadrasaGrade(getMadrasaId(req), req.body);
  return ApiResponse.message(res, "Madrasa grade added successfully");
});

export const updateMadrasaGrade = asyncHandler(async (req: Request, res: Response) => {
  await examService.updateMadrasaGrade(Number(req.params.id), getMadrasaId(req), req.body);
  return ApiResponse.message(res, "Madrasa grade updated successfully");
});

export const deleteMadrasaGrade = asyncHandler(async (req: Request, res: Response) => {
  await examService.deleteMadrasaGrade(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, "Madrasa grade deleted successfully");
});

/* ================= SETTINGS ================= */

export const getFailMark = asyncHandler(async (req: Request, res: Response) => {
  const { division_id, class_id } = req.query;
  // With a division/class scope: the EFFECTIVE fail mark (override ?? global).
  const scoped = division_id !== undefined || class_id !== undefined;
  const value = scoped
    ? await examService.getEffectiveFailMark(getMadrasaId(req), division_id, class_id)
    : await examService.getFailMark(getMadrasaId(req));
  res.json(value);
});

export const getDivisionFailMarks = asyncHandler(async (req: Request, res: Response) => {
  const data = await examService.listDivisionFailMarks(getMadrasaId(req));
  res.json(data);
});

export const updateDivisionFailMark = asyncHandler(async (req: Request, res: Response) => {
  const result = await examService.updateDivisionFailMark(
    getMadrasaId(req),
    Number(req.params.divisionId),
    req.body,
  );
  return ApiResponse.success(res, {
    message: "Division fail mark updated successfully",
    extra: result,
  });
});

export const updateFailMark = asyncHandler(async (req: Request, res: Response) => {
  const result = await examService.updateFailMark(getMadrasaId(req), req.body);
  return ApiResponse.success(res, {
    message: "Fail mark updated successfully",
    extra: result,
  });
});
