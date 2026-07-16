import { Request, Response } from "express";
import { ApiError } from "../../shared/errors";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { accountService } from "./account.service";

export const getAccountOptions = asyncHandler(async (_req: Request, res: Response) => {
  res.json(accountService.getOptions());
});

export const createIncome = asyncHandler(async (req: Request, res: Response) => {
  try {
    const madrasa_id = req.tenant!.madrasa_id;
    const result = await accountService.createIncome(madrasa_id, req.user!.id, req.body);
    res.json(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    throw error;
  }
});

export const createExpense = asyncHandler(async (req: Request, res: Response) => {
  try {
    const madrasa_id = req.tenant!.madrasa_id;
    const result = await accountService.createExpense(madrasa_id, req.user!.id, req.body);
    res.json(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    throw error;
  }
});

export const getReport = asyncHandler(async (req: Request, res: Response) => {
  const madrasa_id = req.tenant!.madrasa_id;
  const type = String(req.query.type || "monthly");
  const groupBy = String(req.query.groupBy || "period");

  const rows = await accountService.getReport(madrasa_id, type, groupBy);
  res.json(rows);
});
