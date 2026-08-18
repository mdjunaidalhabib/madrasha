import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { activityService } from "./activity.service";

export const getLogs = asyncHandler(async (req: Request, res: Response) => {
  const madrasa_id = req.tenant!.madrasa_id;
  const { days, from, to, page, limit } = req.query;

  const result = await activityService.getLogs(madrasa_id, {
    days: days ? Number(days) : undefined,
    from: typeof from === "string" ? from : undefined,
    to: typeof to === "string" ? to : undefined,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  res.json(result);
});
