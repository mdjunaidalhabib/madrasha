import { Request, Response } from "express";
import { HttpStatus } from "../../shared/constants";
import { logger } from "../../shared/logger/logger";
import { metaService } from "./meta.service";

export const listDivisions = async (_req: Request, res: Response) => {
  try {
    const data = await metaService.listDivisions();
    res.json({ data });
  } catch (err: any) {
    logger.error("listDivisions ERROR:", err);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: err.message || "Failed to load divisions" });
  }
};

export const listModules = async (_req: Request, res: Response) => {
  try {
    const data = await metaService.listModules();
    res.json({ data });
  } catch (err: any) {
    logger.error("listModules ERROR:", err);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: err.message || "Failed to load modules" });
  }
};

export const listClasses = async (req: Request, res: Response) => {
  try {
    const divisionId = req.query.division_id ? Number(req.query.division_id) : undefined;
    const data = await metaService.listClasses(divisionId);
    res.json({ data });
  } catch (err: any) {
    logger.error("listClasses ERROR:", err);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: err.message || "Failed to load classes" });
  }
};

export const listBooks = async (req: Request, res: Response) => {
  try {
    const classId = req.query.class_id ? Number(req.query.class_id) : undefined;
    const data = await metaService.listBooks(classId);
    res.json({ data });
  } catch (err: any) {
    logger.error("listBooks ERROR:", err);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: err.message || "Failed to load books" });
  }
};
