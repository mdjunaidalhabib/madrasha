import { Request, Response } from "express";
import { ApiError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { logger } from "../../shared/logger/logger";
import { plansService } from "./plans.service";

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
    res.status(HttpStatus.CREATED).json({ message: "Plan তৈরি হয়েছে", id });
  } catch (error) {
    respondError(res, error, "createPlanAdmin ERROR:");
  }
};

export const updatePlanAdmin = async (req: Request, res: Response) => {
  try {
    await plansService.updatePlan(Number(req.params.id), req.body);
    res.json({ message: "Plan আপডেট হয়েছে" });
  } catch (error) {
    respondError(res, error, "updatePlanAdmin ERROR:");
  }
};

export const togglePlanAdmin = async (req: Request, res: Response) => {
  try {
    await plansService.togglePlan(Number(req.params.id));
    res.json({ message: "Plan status updated" });
  } catch (error) {
    respondError(res, error, "togglePlanAdmin ERROR:");
  }
};

export const deletePlanAdmin = async (req: Request, res: Response) => {
  try {
    await plansService.deletePlan(Number(req.params.id));
    res.json({ message: "Plan trash এ পাঠানো হয়েছে" });
  } catch (error) {
    respondError(res, error, "deletePlanAdmin ERROR:");
  }
};

export const restorePlanAdmin = async (req: Request, res: Response) => {
  try {
    await plansService.restorePlan(Number(req.params.id));
    res.json({ message: "Plan restore হয়েছে" });
  } catch (error) {
    respondError(res, error, "restorePlanAdmin ERROR:");
  }
};

export const permanentDeletePlanAdmin = async (req: Request, res: Response) => {
  try {
    await plansService.permanentDeletePlan(Number(req.params.id));
    res.json({ message: "Plan permanently deleted" });
  } catch (error) {
    respondError(res, error, "permanentDeletePlanAdmin ERROR:");
  }
};
