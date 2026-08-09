import { Request, Response } from "express";
import { ApiError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { logger } from "../../shared/logger/logger";
import { metaService } from "./meta.service";

const respondError = (res: Response, error: unknown, logTag: string, fallbackMessage: string) => {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  logger.error(logTag, error);
  return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: fallbackMessage });
};

/* =========================================================
   DIVISIONS
========================================================= */
export const listDivisions = async (_req: Request, res: Response) => {
  try {
    const data = await metaService.listDivisions();
    res.json({ data });
  } catch (err) {
    respondError(res, err, "listDivisions ERROR:", "Failed to load divisions");
  }
};

export const createDivision = async (req: Request, res: Response) => {
  try {
    const row = await metaService.createDivision(req.body);
    res.status(HttpStatus.CREATED).json({ message: "বিভাগ তৈরি হয়েছে", id: row.id });
  } catch (err) {
    respondError(res, err, "createDivision ERROR:", "Failed to create division");
  }
};

export const updateDivision = async (req: Request, res: Response) => {
  try {
    await metaService.updateDivision(Number(req.params.id), req.body);
    res.json({ message: "বিভাগ আপডেট হয়েছে" });
  } catch (err) {
    respondError(res, err, "updateDivision ERROR:", "Failed to update division");
  }
};

export const deleteDivision = async (req: Request, res: Response) => {
  try {
    await metaService.deleteDivision(Number(req.params.id));
    res.json({ message: "বিভাগ মুছে ফেলা হয়েছে" });
  } catch (err) {
    respondError(res, err, "deleteDivision ERROR:", "Failed to delete division");
  }
};

export const reorderDivisions = async (req: Request, res: Response) => {
  try {
    const ids = (Array.isArray(req.body?.division_ids) ? req.body.division_ids : []).map(Number);
    await metaService.reorderDivisions(ids);
    res.json({ message: "বিভাগের ক্রম সংরক্ষণ করা হয়েছে" });
  } catch (err) {
    respondError(res, err, "reorderDivisions ERROR:", "Failed to reorder divisions");
  }
};

/* =========================================================
   MODULES
========================================================= */
export const listModules = async (_req: Request, res: Response) => {
  try {
    const data = await metaService.listModules();
    res.json({ data });
  } catch (err) {
    respondError(res, err, "listModules ERROR:", "Failed to load modules");
  }
};

/* =========================================================
   CLASSES
========================================================= */
export const listClasses = async (req: Request, res: Response) => {
  try {
    const divisionId = req.query.division_id ? Number(req.query.division_id) : undefined;
    const includeInactive = req.query.include_inactive === "true";
    const data = await metaService.listClasses(divisionId, includeInactive);
    res.json({ data });
  } catch (err) {
    respondError(res, err, "listClasses ERROR:", "Failed to load classes");
  }
};

export const createClass = async (req: Request, res: Response) => {
  try {
    const row = await metaService.createClass(req.body);
    res.status(HttpStatus.CREATED).json({ message: "শ্রেণি তৈরি হয়েছে", id: row.id });
  } catch (err) {
    respondError(res, err, "createClass ERROR:", "Failed to create class");
  }
};

export const updateClass = async (req: Request, res: Response) => {
  try {
    await metaService.updateClass(Number(req.params.id), req.body);
    res.json({ message: "শ্রেণি আপডেট হয়েছে" });
  } catch (err) {
    respondError(res, err, "updateClass ERROR:", "Failed to update class");
  }
};

export const toggleClassActive = async (req: Request, res: Response) => {
  try {
    await metaService.toggleClassActive(Number(req.params.id), req.body?.is_active !== false);
    res.json({ message: "শ্রেণির অবস্থা আপডেট হয়েছে" });
  } catch (err) {
    respondError(res, err, "toggleClassActive ERROR:", "Failed to toggle class");
  }
};

export const deleteClass = async (req: Request, res: Response) => {
  try {
    await metaService.deleteClass(Number(req.params.id));
    res.json({ message: "শ্রেণি মুছে ফেলা হয়েছে" });
  } catch (err) {
    respondError(res, err, "deleteClass ERROR:", "Failed to delete class");
  }
};

export const reorderClasses = async (req: Request, res: Response) => {
  try {
    const divisionId = Number(req.body?.division_id);
    const ids = (Array.isArray(req.body?.class_ids) ? req.body.class_ids : []).map(Number);
    await metaService.reorderClasses(divisionId, ids);
    res.json({ message: "শ্রেণির ক্রম সংরক্ষণ করা হয়েছে" });
  } catch (err) {
    respondError(res, err, "reorderClasses ERROR:", "Failed to reorder classes");
  }
};

/* =========================================================
   BOOKS
========================================================= */
export const listBooks = async (req: Request, res: Response) => {
  try {
    const classId = req.query.class_id ? Number(req.query.class_id) : undefined;
    const data = await metaService.listBooks(classId);
    res.json({ data });
  } catch (err) {
    respondError(res, err, "listBooks ERROR:", "Failed to load books");
  }
};

export const createBook = async (req: Request, res: Response) => {
  try {
    const row = await metaService.createBook(req.body);
    res.status(HttpStatus.CREATED).json({ message: "কিতাব তৈরি হয়েছে", id: row.id });
  } catch (err) {
    respondError(res, err, "createBook ERROR:", "Failed to create book");
  }
};

export const updateBook = async (req: Request, res: Response) => {
  try {
    await metaService.updateBook(Number(req.params.id), req.body);
    res.json({ message: "কিতাব আপডেট হয়েছে" });
  } catch (err) {
    respondError(res, err, "updateBook ERROR:", "Failed to update book");
  }
};

export const deleteBook = async (req: Request, res: Response) => {
  try {
    await metaService.deleteBook(Number(req.params.id));
    res.json({ message: "কিতাব মুছে ফেলা হয়েছে" });
  } catch (err) {
    respondError(res, err, "deleteBook ERROR:", "Failed to delete book");
  }
};

export const reorderBooks = async (req: Request, res: Response) => {
  try {
    const classId = Number(req.body?.class_id);
    const ids = (Array.isArray(req.body?.book_ids) ? req.body.book_ids : []).map(Number);
    await metaService.reorderBooks(classId, ids);
    res.json({ message: "কিতাবের ক্রম সংরক্ষণ করা হয়েছে" });
  } catch (err) {
    respondError(res, err, "reorderBooks ERROR:", "Failed to reorder books");
  }
};
