import { Request, Response } from "express";
import { ApiError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { logger } from "../../shared/logger/logger";
import { superAdminAccountService } from "./superadmin-account.service";

const respondError = (res: Response, error: unknown, logTag?: string) => {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  if (logTag) logger.error(logTag, error);
  return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: (error as Error)?.message });
};

export const listSuperAdmins = async (_req: Request, res: Response) => {
  try {
    const rows = await superAdminAccountService.list();
    res.json({ data: rows });
  } catch (error) {
    respondError(res, error);
  }
};

export const createSuperAdmin = async (req: Request, res: Response) => {
  try {
    const result = await superAdminAccountService.create(req.body);
    res.status(HttpStatus.CREATED).json({ message: "Super admin created", id: result.id });
  } catch (error) {
    respondError(res, error);
  }
};

export const deactivateSuperAdmin = async (req: Request, res: Response) => {
  try {
    await superAdminAccountService.deactivate(Number(req.params.id), Number(req.user!.id));
    res.json({ message: "Super admin deactivated" });
  } catch (error) {
    respondError(res, error);
  }
};

export const reactivateSuperAdmin = async (req: Request, res: Response) => {
  try {
    await superAdminAccountService.reactivate(Number(req.params.id));
    res.json({ message: "Super admin reactivated" });
  } catch (error) {
    respondError(res, error);
  }
};
