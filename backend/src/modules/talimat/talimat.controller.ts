import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { talimatService } from "./talimat.service";

export const createResult = asyncHandler(async (req: Request, res: Response) => {
  const madrasa_id = req.tenant!.madrasa_id;
  await talimatService.createResult(madrasa_id, req.body);
  res.json({ message: "Result saved" });
});

export const getMarksheet = asyncHandler(async (req: Request, res: Response) => {
  const madrasa_id = req.tenant!.madrasa_id;
  const student_id = Number(req.params.student_id);

  const result = await talimatService.getMarksheet(madrasa_id, student_id);
  res.json(result);
});
