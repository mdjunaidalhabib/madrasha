import { Request, Response } from "express";
import { ApiError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { logger } from "../../shared/logger/logger";
import { plansService } from "./plans.service";
import { t } from "../../shared/i18n";

const respondError = (res: Response, error: unknown, logTag: string) => {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  logger.error(logTag, error);
  return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: (error as Error)?.message });
};

export const listPlansAdmin = async (req: Request, res: Response) => {
  try {
    const rows = await plansService.listPlans(req.query);
    res.json({ data: rows || [] });
  } catch (error) {
    respondError(res, error, "listPlansAdmin ERROR:");
  }
};

export const listTrashPlans = async (_req: Request, res: Response) => {
  try {
    const rows = await plansService.listTrash();
    res.json({ data: rows || [] });
  } catch (error) {
    respondError(res, error, "listTrashPlans ERROR:");
  }
};

export const createPlanAdmin = async (req: Request, res: Response) => {
  try {
    const id = await plansService.createPlan(req.body);
    res.status(HttpStatus.CREATED).json({ message: t({ bn: "প্ল্যান তৈরি হয়েছে", en: "Plan created" }), id });
  } catch (error) {
    respondError(res, error, "createPlanAdmin ERROR:");
  }
};

export const updatePlanAdmin = async (req: Request, res: Response) => {
  try {
    await plansService.updatePlan(Number(req.params.id), req.body);
    res.json({ message: t({ bn: "প্ল্যান আপডেট হয়েছে", en: "Plan updated" }) });
  } catch (error) {
    respondError(res, error, "updatePlanAdmin ERROR:");
  }
};

export const togglePlanAdmin = async (req: Request, res: Response) => {
  try {
    await plansService.togglePlan(Number(req.params.id));
    res.json({ message: t({ bn: "প্ল্যানের অবস্থা আপডেট হয়েছে", en: "Plan status updated" }) });
  } catch (error) {
    respondError(res, error, "togglePlanAdmin ERROR:");
  }
};

export const deletePlanAdmin = async (req: Request, res: Response) => {
  try {
    await plansService.deletePlan(Number(req.params.id));
    res.json({ message: t({ bn: "প্ল্যান ট্র্যাশে পাঠানো হয়েছে", en: "Plan moved to trash" }) });
  } catch (error) {
    respondError(res, error, "deletePlanAdmin ERROR:");
  }
};

export const restorePlanAdmin = async (req: Request, res: Response) => {
  try {
    await plansService.restorePlan(Number(req.params.id));
    res.json({ message: t({ bn: "প্ল্যান পুনরুদ্ধার হয়েছে", en: "Plan restored" }) });
  } catch (error) {
    respondError(res, error, "restorePlanAdmin ERROR:");
  }
};

export const permanentDeletePlanAdmin = async (req: Request, res: Response) => {
  try {
    await plansService.permanentDeletePlan(Number(req.params.id));
    res.json({ message: t({ bn: "প্ল্যান স্থায়ীভাবে মুছে ফেলা হয়েছে", en: "Plan permanently deleted" }) });
  } catch (error) {
    respondError(res, error, "permanentDeletePlanAdmin ERROR:");
  }
};
