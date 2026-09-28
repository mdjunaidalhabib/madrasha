import { Request, Response } from "express";
import { ApiError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { logger } from "../../shared/logger/logger";
import { superAdminAccountService } from "./superadmin-account.service";
import { t } from "../../shared/i18n";

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
    res.status(HttpStatus.CREATED).json({ message: t({ bn: "সুপার অ্যাডমিন তৈরি হয়েছে", en: "Super admin created" }), id: result.id });
  } catch (error) {
    respondError(res, error);
  }
};

export const deactivateSuperAdmin = async (req: Request, res: Response) => {
  try {
    await superAdminAccountService.deactivate(Number(req.params.id), Number(req.user!.id));
    res.json({ message: t({ bn: "সুপার অ্যাডমিন নিষ্ক্রিয় করা হয়েছে", en: "Super admin deactivated" }) });
  } catch (error) {
    respondError(res, error);
  }
};

export const reactivateSuperAdmin = async (req: Request, res: Response) => {
  try {
    await superAdminAccountService.reactivate(Number(req.params.id));
    res.json({ message: t({ bn: "সুপার অ্যাডমিন পুনরায় সক্রিয় করা হয়েছে", en: "Super admin reactivated" }) });
  } catch (error) {
    respondError(res, error);
  }
};
