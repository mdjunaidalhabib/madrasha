import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { TenantNotFoundInRequestError } from "../../shared/errors";
import { roleService } from "./role.service";
import { t } from "../../shared/i18n";

const getMadrasaId = (req: Request): number => {
  const madrasaId = req.tenant?.madrasa_id;
  if (!madrasaId) throw new TenantNotFoundInRequestError();
  return Number(madrasaId);
};

export const getRoles = asyncHandler(async (req: Request, res: Response) => {
  const data = await roleService.listRoles(getMadrasaId(req));
  res.json({ success: true, data });
});

export const getPermissionCatalog = asyncHandler(async (req: Request, res: Response) => {
  const data = await roleService.listPermissionCatalog();
  res.json({ success: true, data });
});

export const createRole = asyncHandler(async (req: Request, res: Response) => {
  const data = await roleService.createRole(getMadrasaId(req), req.body);
  return ApiResponse.success(res, { message: t({ bn: "রোল তৈরি হয়েছে", en: "Role created successfully", ar: "تم إنشاء الدور بنجاح" }), data });
});

export const updateRole = asyncHandler(async (req: Request, res: Response) => {
  await roleService.updateRole(Number(req.params.id), getMadrasaId(req), req.body);
  return ApiResponse.message(res, t({ bn: "রোল আপডেট হয়েছে", en: "Role updated successfully", ar: "تم تحديث الدور بنجاح" }));
});

export const deleteRole = asyncHandler(async (req: Request, res: Response) => {
  await roleService.deleteRole(Number(req.params.id), getMadrasaId(req));
  return ApiResponse.message(res, t({ bn: "রোল মুছে ফেলা হয়েছে", en: "Role deleted successfully", ar: "تم حذف الدور بنجاح" }));
});
