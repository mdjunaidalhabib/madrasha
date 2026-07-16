import { Request, Response } from "express";
import { ApiError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { teacherAssignmentService } from "./teacher-assignment.service";
import { InvalidAssignmentRequestError, MadrasaNotFoundError } from "./teacher-assignment.types";

const getMadrasaId = (req: Request): number | null => {
  const madrasaId = req.tenant?.madrasa_id;
  return madrasaId ? Number(madrasaId) : null;
};

const respond500 = (res: Response, err: unknown) =>
  res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: (err as Error)?.message });

/* ================= GET SINGLE ================= */
export const getAssignments = async (req: Request, res: Response) => {
  try {
    const madrasa_id = getMadrasaId(req);
    if (!madrasa_id) throw new MadrasaNotFoundError();

    const teacher_id = Number(req.query.teacher_id);
    const class_id = Number(req.query.class_id);

    const bookIds = await teacherAssignmentService.getBookIds(madrasa_id, teacher_id, class_id);
    return res.json(bookIds);
  } catch (err) {
    if (err instanceof ApiError) return res.status(err.statusCode).json({ message: err.message });
    return respond500(res, err);
  }
};

/* ================= GET ALL ================= */
export const getAllAssignments = async (req: Request, res: Response) => {
  try {
    const madrasa_id = getMadrasaId(req);
    if (!madrasa_id) throw new MadrasaNotFoundError();

    const data = await teacherAssignmentService.getAllGrouped(madrasa_id);
    return res.json({ data });
  } catch (err) {
    if (err instanceof ApiError) return res.status(err.statusCode).json({ message: err.message });
    return respond500(res, err);
  }
};

/* ================= CREATE ================= */
export const saveAssignment = async (req: Request, res: Response) => {
  try {
    const madrasa_id = getMadrasaId(req);
    if (!madrasa_id) throw new MadrasaNotFoundError();

    const teacher_id = Number(req.body.teacher_id);
    const class_id = Number(req.body.class_id);
    const book_ids: number[] = req.body.book_ids || [];

    await teacherAssignmentService.saveAssignment(madrasa_id, teacher_id, class_id, book_ids);
    return res.json({ success: true });
  } catch (err) {
    if (err instanceof ApiError) return res.status(err.statusCode).json({ message: err.message });
    return respond500(res, err);
  }
};

/* ================= UPDATE ================= */
export const updateAssignment = async (req: Request, res: Response) => {
  try {
    const madrasa_id = getMadrasaId(req);
    if (!madrasa_id) throw new MadrasaNotFoundError();

    const teacher_id = Number(req.body.teacher_id);
    const class_id = Number(req.body.class_id);
    const book_ids: number[] = req.body.book_ids || [];

    await teacherAssignmentService.updateAssignment(madrasa_id, teacher_id, class_id, book_ids);
    return res.json({ success: true });
  } catch (err) {
    if (err instanceof ApiError) return res.status(err.statusCode).json({ message: err.message });
    return respond500(res, err);
  }
};

/* ================= DELETE ================= */
export const deleteAssignment = async (req: Request, res: Response) => {
  try {
    const madrasa_id = getMadrasaId(req);
    if (!madrasa_id) throw new MadrasaNotFoundError();

    const teacher_id = Number(req.body.teacher_id);
    const class_id = Number(req.body.class_id);

    if (!teacher_id || !class_id) throw new InvalidAssignmentRequestError();

    await teacherAssignmentService.deleteAssignment(madrasa_id, teacher_id, class_id);
    return res.json({ success: true });
  } catch (err) {
    if (err instanceof ApiError) return res.status(err.statusCode).json({ message: err.message });
    return respond500(res, err);
  }
};
