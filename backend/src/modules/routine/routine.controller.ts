import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { TenantNotFoundInRequestError } from "../../shared/errors";
import { routineService } from "./routine.service";

const getMadrasaId = (req: Request): number => {
  const madrasaId = req.tenant?.madrasa_id;
  if (!madrasaId) throw new TenantNotFoundInRequestError();
  return Number(madrasaId);
};

/* ================= CLASS ROUTINE ================= */

export const getClassRoutines = asyncHandler(async (req: Request, res: Response) => {
  const classId = req.query.class_id ? Number(req.query.class_id) : undefined;
  const data = await routineService.listClassRoutines(getMadrasaId(req), classId);
  res.json({ success: true, data });
});

export const createClassRoutine = asyncHandler(async (req: Request, res: Response) => {
  await routineService.createClassRoutine(getMadrasaId(req), req.body);
  return ApiResponse.message(res, "Class routine added successfully");
});

export const updateClassRoutine = asyncHandler(async (req: Request, res: Response) => {
  await routineService.updateClassRoutine(Number(req.params.id), getMadrasaId(req), req.body);
  return ApiResponse.message(res, "Class routine updated successfully");
});

export const deleteClassRoutine = asyncHandler(async (req: Request, res: Response) => {
  await routineService.deleteClassRoutine(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, "Class routine deleted successfully");
});

/* ================= EXAM ROUTINE ================= */

export const getExamRoutines = asyncHandler(async (req: Request, res: Response) => {
  const examId = req.query.exam_id ? Number(req.query.exam_id) : undefined;
  const classId = req.query.class_id ? Number(req.query.class_id) : undefined;
  const data = await routineService.listExamRoutines(getMadrasaId(req), examId, classId);
  res.json({ success: true, data });
});

export const createExamRoutine = asyncHandler(async (req: Request, res: Response) => {
  await routineService.createExamRoutine(getMadrasaId(req), req.body);
  return ApiResponse.message(res, "Exam routine added successfully");
});

export const updateExamRoutine = asyncHandler(async (req: Request, res: Response) => {
  await routineService.updateExamRoutine(Number(req.params.id), getMadrasaId(req), req.body);
  return ApiResponse.message(res, "Exam routine updated successfully");
});

export const deleteExamRoutine = asyncHandler(async (req: Request, res: Response) => {
  await routineService.deleteExamRoutine(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, "Exam routine deleted successfully");
});
