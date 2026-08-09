import { Request, Response } from "express";
import { ApiError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { logger } from "../../shared/logger/logger";
import { defaultFeeStructureService } from "./default-fee-structure.service";

const respondError = (res: Response, error: unknown, logTag: string, fallbackMessage: string) => {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  logger.error(logTag, error);
  return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: fallbackMessage });
};

export const listDefaultFeeStructures = async (req: Request, res: Response) => {
  try {
    const classId = req.query.class_id ? Number(req.query.class_id) : undefined;
    const data = await defaultFeeStructureService.list(classId);
    res.json({ data });
  } catch (err) {
    respondError(res, err, "listDefaultFeeStructures ERROR:", "Failed to load fee structure templates");
  }
};

export const createDefaultFeeStructure = async (req: Request, res: Response) => {
  try {
    const row = await defaultFeeStructureService.create(req.body);
    res.status(HttpStatus.CREATED).json({ message: "ফি টেমপ্লেট তৈরি হয়েছে", id: row.id });
  } catch (err) {
    respondError(res, err, "createDefaultFeeStructure ERROR:", "Failed to create fee structure template");
  }
};

export const updateDefaultFeeStructure = async (req: Request, res: Response) => {
  try {
    await defaultFeeStructureService.update(Number(req.params.id), req.body);
    res.json({ message: "ফি টেমপ্লেট আপডেট হয়েছে" });
  } catch (err) {
    respondError(res, err, "updateDefaultFeeStructure ERROR:", "Failed to update fee structure template");
  }
};

export const deleteDefaultFeeStructure = async (req: Request, res: Response) => {
  try {
    await defaultFeeStructureService.delete(Number(req.params.id));
    res.json({ message: "ফি টেমপ্লেট মুছে ফেলা হয়েছে" });
  } catch (err) {
    respondError(res, err, "deleteDefaultFeeStructure ERROR:", "Failed to delete fee structure template");
  }
};
