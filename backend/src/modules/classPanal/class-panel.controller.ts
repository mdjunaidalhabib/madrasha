import { Request, Response } from "express";
import { ApiError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { logger } from "../../shared/logger/logger";
import { classPanelService } from "./class-panel.service";
import { t } from "../../shared/i18n";

const respondError = (res: Response, error: unknown, logTag: string, fallbackMessage: string) => {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      message: error.message,
      ...(error.details !== undefined ? { details: error.details } : {}),
    });
  }
  logger.error(logTag, error);
  return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: fallbackMessage });
};

/* =========================================================
   STUDENT REGISTRATION-NUMBER BLOCKS (per class)
========================================================= */
export const getRegistrationBlocks = async (req: Request, res: Response) => {
  try {
    const data = await classPanelService.listRegistrationBlocks(req.tenant?.madrasa_id);
    res.json(data);
  } catch (error) {
    respondError(res, error, "❌ Registration block fetch error:", "Failed to load registration blocks");
  }
};

export const updateRegistrationBlock = async (req: Request, res: Response) => {
  try {
    const data = await classPanelService.updateRegistrationBlock(
      req.tenant?.madrasa_id,
      Number(req.params.classId),
      req.body,
    );
    res.json(data);
  } catch (error) {
    respondError(res, error, "❌ Registration block update error:", "Failed to save registration block");
  }
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

export const deleteDivision = async (req: Request, res: Response) => {
  try {
    await classPanelService.deleteDivision(req.tenant?.madrasa_id, Number(req.params.id));
    res.json({ message: t({ bn: "বিভাগ প্রতিষ্ঠান থেকে সরানো হয়েছে", en: "Division removed from institution" }) });
  } catch (error) {
    respondError(res, error, "❌ Delete division error:", "Failed to delete division");
  }
};

export const updateDivision = async (req: Request, res: Response) => {
  try {
    await classPanelService.updateDivision(req.tenant?.madrasa_id, Number(req.params.id), req.body);
    res.json({ message: t({ bn: "বিভাগ আপডেট হয়েছে", en: "Division updated successfully" }) });
  } catch (error) {
    respondError(res, error, "❌ Update division error:", "Failed to update division");
  }
};

export const reorderDivisions = async (req: Request, res: Response) => {
  try {
    const data = await classPanelService.reorderDivisions(req.tenant?.madrasa_id, req.body);
    res.json(data);
  } catch (error) {
    respondError(res, error, "❌ Reorder divisions error:", "Failed to reorder divisions");
  }
};

/* =========================================================
   CLASSES
========================================================= */
export const getClasses = async (req: Request, res: Response) => {
  try {
    const data = await classPanelService.listClasses(
      req.tenant?.madrasa_id,
      Number(req.query.division_id),
    );
    res.json(data);
  } catch (error) {
    respondError(res, error, "❌ Class fetch error:", "Failed to load classes");
  }
};

export const addClass = async (req: Request, res: Response) => {
  try {
    await classPanelService.addClass(req.tenant?.madrasa_id, req.body);
    res.json({ message: t({ bn: "শ্রেণি যোগ করা হয়েছে", en: "Class added successfully" }) });
  } catch (error) {
    respondError(res, error, "❌ Add class error:", "Failed to add class");
  }
};

export const updateClass = async (req: Request, res: Response) => {
  try {
    await classPanelService.updateClass(req.tenant?.madrasa_id, Number(req.params.id), req.body);
    res.json({ message: t({ bn: "শ্রেণি আপডেট হয়েছে", en: "Class updated successfully" }) });
  } catch (error) {
    respondError(res, error, "❌ Update class error:", "Failed to update class");
  }
};

export const deleteClass = async (req: Request, res: Response) => {
  try {
    await classPanelService.deleteClass(req.tenant?.madrasa_id, Number(req.params.id));
    res.json({ message: t({ bn: "শ্রেণি প্রতিষ্ঠান থেকে সরানো হয়েছে", en: "Class removed from institution" }) });
  } catch (error) {
    respondError(res, error, "❌ Delete class error:", "Failed to delete class");
  }
};

export const reorderClasses = async (req: Request, res: Response) => {
  try {
    const data = await classPanelService.reorderClasses(req.tenant?.madrasa_id, req.body);
    res.json(data);
  } catch (error) {
    respondError(res, error, "❌ Reorder classes error:", "Failed to reorder classes");
  }
};

/* =========================================================
   BOOKS (বাংলা enabled)
========================================================= */
export const getSubjects = async (req: Request, res: Response) => {
  try {
    const data = await classPanelService.listSubjects(
      req.tenant?.madrasa_id,
      Number(req.query.class_id),
    );
    res.json(data);
  } catch (error) {
    respondError(res, error, "❌ Book fetch error:", "Failed to load books");
  }
};


export const updateMiyariSubjects = async (req: Request, res: Response) => {
  try {
    const data = await classPanelService.updateMiyariSubjects(req.tenant?.madrasa_id, req.body);
    res.json(data);
  } catch (error) {
    respondError(res, error, "❌ Miyari subject update error:", "Failed to update miyari subjects");
  }
};

export const reorderSubjects = async (req: Request, res: Response) => {
  try {
    const data = await classPanelService.reorderSubjects(req.tenant?.madrasa_id, req.body);
    res.json(data);
  } catch (error) {
    respondError(res, error, "❌ Reorder subjects error:", "Failed to reorder books");
  }
};

export const addSubject = async (req: Request, res: Response) => {
  try {
    await classPanelService.addSubject(req.tenant?.madrasa_id, req.body);
    res.json({ message: t({ bn: "বিষয় যোগ করা হয়েছে এবং সংশ্লিষ্ট ফলাফল হালনাগাদ হয়েছে", en: "Subject added and affected results refreshed" }) });
  } catch (error) {
    respondError(res, error, "❌ Add subject error:", "Failed to add subject");
  }
};

export const updateSubject = async (req: Request, res: Response) => {
  try {
    await classPanelService.updateSubject(req.tenant?.madrasa_id, Number(req.params.id), req.body);
    res.json({ message: t({ bn: "বিষয়ের নাম আপডেট হয়েছে", en: "Subject name updated successfully" }) });
  } catch (error) {
    respondError(res, error, "❌ Update subject error:", "Failed to update subject");
  }
};

export const getSubjectDeleteInfo = async (req: Request, res: Response) => {
  try {
    const data = await classPanelService.getSubjectDeleteInfo(
      req.tenant?.madrasa_id,
      Number(req.params.id),
    );
    res.json(data);
  } catch (error) {
    respondError(res, error, "❌ Subject delete info error:", "Failed to check subject marks");
  }
};

export const deleteSubject = async (req: Request, res: Response) => {
  try {
    await classPanelService.deleteSubject(req.tenant?.madrasa_id, Number(req.params.id));
    res.json({ message: t({ bn: "বিষয় সরানো হয়েছে এবং সংশ্লিষ্ট ফলাফল পুনঃগণনা হয়েছে", en: "Subject removed and affected results recalculated" }) });
  } catch (error) {
    respondError(res, error, "❌ Delete subject error:", "Failed to delete subject");
  }
};
