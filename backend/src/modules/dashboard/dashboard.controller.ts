import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { dashboardService } from "./dashboard.service";

export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  const madrasa_id = req.tenant!.madrasa_id;
  const summary = await dashboardService.getSummary(madrasa_id);
  res.json(summary);
});
