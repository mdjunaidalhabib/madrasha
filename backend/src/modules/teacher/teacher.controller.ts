import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { HttpStatus } from "../../shared/constants";
import { teacherService } from "./teacher.service";

export const createTeacher = asyncHandler(async (req: Request, res: Response) => {
  const madrasaId = req.tenant?.madrasa_id;
  const id = await teacherService.createTeacher(req.body, madrasaId);

  return ApiResponse.success(res, {
    message: "Teacher created successfully",
    statusCode: HttpStatus.CREATED,
    extra: { id },
  });
});

export const bulkCreateTeachers = asyncHandler(async (req: Request, res: Response) => {
  const madrasaId = req.tenant?.madrasa_id;
  const teachers = Array.isArray(req.body?.teachers) ? req.body.teachers : [];
  const result = await teacherService.bulkCreateTeachers(teachers, madrasaId);

  return ApiResponse.success(res, {
    message: "Teachers processed successfully",
    statusCode: HttpStatus.CREATED,
    extra: result,
  });
});

export const getTeachers = asyncHandler(async (req: Request, res: Response) => {
  const madrasaId = req.tenant?.madrasa_id;
  const data = await teacherService.listTeachers(madrasaId);
  return ApiResponse.success(res, { data });
});

export const getTeacherById = asyncHandler(async (req: Request, res: Response) => {
  const madrasaId = req.tenant?.madrasa_id;
  const data = await teacherService.getTeacherDetail(Number(req.params.id), madrasaId);
  return ApiResponse.success(res, { data });
});

export const updateTeacher = asyncHandler(async (req: Request, res: Response) => {
  const madrasaId = req.tenant?.madrasa_id;
  const affectedRows = await teacherService.updateTeacher(Number(req.params.id), madrasaId, req.body);

  return ApiResponse.success(res, {
    message: "Teacher updated successfully",
    extra: { affectedRows },
  });
});

export const deleteTeacher = asyncHandler(async (req: Request, res: Response) => {
  const madrasaId = req.tenant?.madrasa_id;
  const affectedRows = await teacherService.deleteTeacher(Number(req.params.id), madrasaId);

  return ApiResponse.success(res, {
    message: "Teacher deleted",
    extra: { affectedRows },
  });
});
