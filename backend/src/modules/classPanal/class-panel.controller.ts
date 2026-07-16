import { Request, Response } from "express";
import { ApiError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { logger } from "../../shared/logger/logger";
import { classPanelService } from "./class-panel.service";

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
export const getDivisions = async (req: Request, res: Response) => {
  try {
    const data = await classPanelService.listDivisions(req.tenant?.madrasa_id);
    res.json(data);
  } catch (error) {
    respondError(res, error, "❌ Division fetch error:", "Failed to load divisions");
  }
};

/* =========================================================
   CLASSES
========================================================= */
export const getClasses = async (req: Request, res: Response) => {
  try {
    const data = await classPanelService.listClasses(req.tenant?.madrasa_id, Number(req.query.division_id));
    res.json(data);
  } catch (error) {
    respondError(res, error, "❌ Class fetch error:", "Failed to load classes");
  }
};

export const addClass = async (req: Request, res: Response) => {
  try {
    await classPanelService.addClass(req.tenant?.madrasa_id, req.body);
    res.json({ message: "Class added successfully" });
  } catch (error) {
    respondError(res, error, "❌ Add class error:", "Failed to add class");
  }
};

export const updateClass = async (req: Request, res: Response) => {
  try {
    await classPanelService.updateClass(Number(req.params.id), req.body);
    res.json({ message: "Class updated successfully" });
  } catch (error) {
    respondError(res, error, "❌ Update class error:", "Failed to update class");
  }
};

export const deleteClass = async (req: Request, res: Response) => {
  try {
    await classPanelService.deleteClass(req.tenant?.madrasa_id, Number(req.params.id));
    res.json({ message: "Class removed from madrasa" });
  } catch (error) {
    respondError(res, error, "❌ Delete class error:", "Failed to delete class");
  }
};

/* =========================================================
   BOOKS (বাংলা enabled)
========================================================= */
export const getSubjects = async (req: Request, res: Response) => {
  try {
    const data = await classPanelService.listSubjects(req.tenant?.madrasa_id, Number(req.query.class_id));
    res.json(data);
  } catch (error) {
    respondError(res, error, "❌ Book fetch error:", "Failed to load books");
  }
};

export const addSubject = async (req: Request, res: Response) => {
  try {
    await classPanelService.addSubject(req.tenant?.madrasa_id, req.body);
    res.json({ message: "Book added successfully" });
  } catch (error) {
    respondError(res, error, "❌ Add book error:", "Failed to add book");
  }
};

export const updateSubject = async (req: Request, res: Response) => {
  try {
    await classPanelService.updateSubject(Number(req.params.id), req.body);
    res.json({ message: "Book updated successfully" });
  } catch (error) {
    respondError(res, error, "❌ Update book error:", "Failed to update book");
  }
};

export const deleteSubject = async (req: Request, res: Response) => {
  try {
    await classPanelService.deleteSubject(req.tenant?.madrasa_id, Number(req.params.id));
    res.json({ message: "Book removed from madrasa" });
  } catch (error) {
    respondError(res, error, "❌ Delete book error:", "Failed to delete book");
  }
};
