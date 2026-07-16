import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { activityService } from "./activity.service";

export const getLogs = asyncHandler(async (req: Request, res: Response) => {
  const madrasa_id = req.tenant!.madrasa_id;
  const rows = await activityService.getRecentLogs(madrasa_id);
  res.json(rows);
});
