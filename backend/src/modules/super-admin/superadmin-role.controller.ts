import { Request, Response } from "express";
import { ApiError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { logger } from "../../shared/logger/logger";
import { roleService } from "../roles/role.service";

// roleService's methods already take a plain madrasaId (no dependency on
// req.tenant), so the super admin panel can call the exact same tenant
// role/permission logic - same validation, same MUHTAMIM permission-edit
// guard (roleService.updateRole refuses it, since Muhtamim bypasses RBAC
// anyway and editing would be a silent no-op) - without duplicating it here.

const respondError = (res: Response, error: unknown, logTag?: string) => {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  if (logTag) logger.error(logTag, error);
  return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: (error as Error)?.message });
};

export const listMadrasaPermissionCatalog = async (_req: Request, res: Response) => {
  try {
    const data = await roleService.listPermissionCatalog();
    res.json({ data });
  } catch (error) {
    respondError(res, error);
  }
};

export const listMadrasaRolePermissions = async (req: Request, res: Response) => {
  try {
    const data = await roleService.listRoles(Number(req.params.id));
    res.json({ data });
  } catch (error) {
    respondError(res, error);
  }
};

export const createMadrasaRole = async (req: Request, res: Response) => {
  try {
    const result = await roleService.createRole(Number(req.params.id), req.body);
    res.status(HttpStatus.CREATED).json({ message: "Role created", data: result });
  } catch (error) {
    respondError(res, error);
  }
};

export const updateMadrasaRole = async (req: Request, res: Response) => {
  try {
    await roleService.updateRole(Number(req.params.roleId), Number(req.params.id), req.body);
    res.json({ message: "Role updated" });
  } catch (error) {
    respondError(res, error);
  }
};

export const deleteMadrasaRole = async (req: Request, res: Response) => {
  try {
    await roleService.deleteRole(Number(req.params.roleId), Number(req.params.id));
    res.json({ message: "Role deleted" });
  } catch (error) {
    respondError(res, error);
  }
};
