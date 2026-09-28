import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { HttpStatus } from "../../shared/constants";
import { teacherService } from "./teacher.service";
import { t } from "../../shared/i18n";

export const createTeacher = asyncHandler(async (req: Request, res: Response) => {
  const madrasaId = req.tenant?.madrasa_id;
  const id = await teacherService.createTeacher(req.body, madrasaId);

  return ApiResponse.success(res, {
    message: t({ bn: "শিক্ষক তৈরি হয়েছে", en: "Teacher created successfully", ar: "تم إنشاء المعلم بنجاح" }),
    statusCode: HttpStatus.CREATED,
    extra: { id },
  });
});

export const bulkCreateTeachers = asyncHandler(async (req: Request, res: Response) => {
  const madrasaId = req.tenant?.madrasa_id;
  const teachers = Array.isArray(req.body?.teachers) ? req.body.teachers : [];
  const result = await teacherService.bulkCreateTeachers(teachers, madrasaId);

  return ApiResponse.success(res, {
    message: t({ bn: "শিক্ষকদের তথ্য প্রক্রিয়া করা হয়েছে", en: "Teachers processed successfully", ar: "تمت معالجة بيانات المعلمين بنجاح" }),
    statusCode: HttpStatus.CREATED,
    extra: result,
  });
});

export const getTeachers = asyncHandler(async (req: Request, res: Response) => {
  const madrasaId = req.tenant?.madrasa_id;
  const data = await teacherService.listTeachers(madrasaId);
  return ApiResponse.success(res, { data });
});

export const getTeacherDashboardSummary = asyncHandler(async (req: Request, res: Response) => {
  const madrasaId = req.tenant?.madrasa_id;
  const data = await teacherService.getDashboardSummary(madrasaId);
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
    message: t({ bn: "শিক্ষকের তথ্য আপডেট হয়েছে", en: "Teacher updated successfully", ar: "تم تحديث بيانات المعلم بنجاح" }),
    extra: { affectedRows },
  });
});

export const updateTeachersBulk = asyncHandler(async (req: Request, res: Response) => {
  const madrasaId = req.tenant?.madrasa_id;
  const teachers = Array.isArray(req.body?.teachers) ? req.body.teachers : [];
  const result = await teacherService.updateTeachersBulk(teachers, madrasaId);

  return ApiResponse.success(res, {
    message: t({ bn: "একসাথে আপডেট প্রক্রিয়া সম্পন্ন হয়েছে", en: "Bulk update processed", ar: "تمت معالجة التحديث الجماعي" }),
    extra: result,
  });
});

export const deleteTeacher = asyncHandler(async (req: Request, res: Response) => {
  const madrasaId = req.tenant?.madrasa_id;
  const affectedRows = await teacherService.deleteTeacher(Number(req.params.id), madrasaId);

  return ApiResponse.success(res, {
    message: t({ bn: "শিক্ষক মুছে ফেলা হয়েছে", en: "Teacher deleted", ar: "تم حذف المعلم" }),
    extra: { affectedRows },
  });
});

/* NAMES BULK (নাম (৩ ভাষা) page) */
export const updateTeacherNamesBulk = asyncHandler(async (req: Request, res: Response) => {
  const madrasaId = req.tenant?.madrasa_id;
  const data = await teacherService.updateNamesBulk(madrasaId, req.body.items || []);
  return ApiResponse.success(res, { message: t({ bn: "শিক্ষকদের নাম আপডেট হয়েছে", en: "Teacher names updated", ar: "تم تحديث أسماء المعلمين" }), data });
});
