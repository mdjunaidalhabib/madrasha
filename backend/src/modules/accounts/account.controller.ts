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

export const listAccounts = asyncHandler(async (req: Request, res: Response) => {
  const madrasa_id = req.tenant!.madrasa_id;
  const rows = await accountService.list(madrasa_id, req.query);
  res.json(rows);
});

export const updateAccount = asyncHandler(async (req: Request, res: Response) => {
  try {
    const madrasa_id = req.tenant!.madrasa_id;
    const result = await accountService.update(madrasa_id, req.user!.id, Number(req.params.id), req.body);
    res.json(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    throw error;
  }
});

export const deleteAccount = asyncHandler(async (req: Request, res: Response) => {
  try {
    const madrasa_id = req.tenant!.madrasa_id;
    const result = await accountService.remove(madrasa_id, req.user!.id, Number(req.params.id));
    res.json(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    throw error;
  }
});
