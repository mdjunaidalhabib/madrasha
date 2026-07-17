import { Request, Response } from "express";
import { ApiError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { logger } from "../../shared/logger/logger";
import { studentService } from "./student.service";
import { MissingFieldsError } from "./student.types";

/**
 * Translates a thrown error into the exact `{ success: false, message, ... }`
 * shape the original controller produced. Handles the one case
 * (MissingFieldsError) whose response has extra top-level fields beyond
 * `message`, then falls back to `ApiError.statusCode`, then a generic 500.
 */
const respondWithError = (res: Response, error: unknown, logTag: string) => {
  if (error instanceof MissingFieldsError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      missing_fields: error.missingFields,
      received: error.received,
    });
  }

  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }

  if ((error as any)?.code === "P2002") {
    return res.status(HttpStatus.CONFLICT).json({
      success: false,
      message: "এই শ্রেণি ও শিক্ষাবর্ষে রোল নম্বরটি ইতোমধ্যে ব্যবহৃত হয়েছে",
    });
  }

  logger.error(logTag, error);
  return res
    .status(HttpStatus.INTERNAL_SERVER_ERROR)
    .json({ success: false, message: (error as Error)?.message });
};

/* =========================================================
   GET ALL STUDENTS
========================================================= */
export const getStudents = async (req: Request, res: Response) => {
  try {
    const madrasaId = req.tenant?.madrasa_id;
    const { class_id, division_id, academic_year } = req.query;

    const data = await studentService.listStudents(madrasaId, {
      classId: class_id ? Number(class_id) : undefined,
      divisionId: division_id ? Number(division_id) : undefined,
      academicYear: academic_year ? String(academic_year) : undefined,
    });

    return res.json({ success: true, data });
  } catch (error) {
    return respondWithError(res, error, "GET STUDENTS ERROR:");
  }
};

/* =========================================================
   GET SINGLE STUDENT
========================================================= */
export const getStudentById = async (req: Request, res: Response) => {
  try {
    const madrasaId = req.tenant?.madrasa_id;
    const data = await studentService.getStudentDetail(Number(req.params.id), madrasaId);

    return res.json({ success: true, data });
  } catch (error) {
    return respondWithError(res, error, "GET STUDENT BY ID ERROR:");
  }
};

/* =========================================================
   LOOKUP STUDENT BY NID (returning-student check for admission)
========================================================= */
export const lookupStudentByNid = async (req: Request, res: Response) => {
  try {
    const madrasaId = req.tenant?.madrasa_id;
    const nid = String(req.query.nid || "").trim();

    if (!nid) {
      return res.json({ success: true, found: false, data: null });
    }

    const data = await studentService.lookupByNid(nid, madrasaId);

    return res.json({ success: true, found: Boolean(data), data });
  } catch (error) {
    return respondWithError(res, error, "LOOKUP STUDENT BY NID ERROR:");
  }
};

/* =========================================================
   CREATE SINGLE STUDENT
========================================================= */
export const createStudent = async (req: Request, res: Response) => {
  try {
    const madrasaId = req.tenant?.madrasa_id;
    const result = await studentService.admitStudent(req.body || {}, madrasaId);

    const message =
      result.action === "re_admitted"
        ? "পূর্বের তথ্য পাওয়া গেছে - শিক্ষার্থী নতুন সেশনে পুনঃভর্তি (আপডেট) হয়েছে"
        : "Student admitted successfully";

    return res.json({
      success: true,
      message,
      studentId: result.studentId,
      action: result.action,
      previousAcademicYear: result.previousAcademicYear,
    });
  } catch (error) {
    return respondWithError(res, error, "🔥 CREATE STUDENT ERROR:");
  }
};

/* =========================================================
   CREATE BULK STUDENTS FROM EXCEL
========================================================= */
export const createStudentsBulk = async (req: Request, res: Response) => {
  try {
    const madrasaId = req.tenant?.madrasa_id;
    const result = await studentService.admitStudentsBulk(req.body?.students, madrasaId);

    return res.json({
      success: true,
      message: "Bulk admission processed",
      ...result,
    });
  } catch (error) {
    return respondWithError(res, error, "🔥 BULK UPSERT STUDENT ERROR:");
  }
};

/* =========================================================
   UPDATE STUDENT
========================================================= */
export const updateStudent = async (req: Request, res: Response) => {
  try {
    const madrasaId = req.tenant?.madrasa_id;
    const affectedRows = await studentService.updateStudent(
      Number(req.params.id),
      madrasaId,
      req.body,
    );

    return res.json({
      success: true,
      message: "Student updated successfully",
      affectedRows,
    });
  } catch (error) {
    return respondWithError(res, error, "UPDATE STUDENT ERROR:");
  }
};

/* =========================================================
   DELETE STUDENT
========================================================= */
export const deleteStudent = async (req: Request, res: Response) => {
  try {
    const madrasaId = req.tenant?.madrasa_id;
    const affectedRows = await studentService.deleteStudent(Number(req.params.id), madrasaId);

    return res.json({
      success: true,
      message: "Student deleted successfully",
      affectedRows,
    });
  } catch (error) {
    return respondWithError(res, error, "DELETE STUDENT ERROR:");
  }
};
