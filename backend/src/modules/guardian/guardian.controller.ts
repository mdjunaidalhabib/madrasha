import { Request, Response } from "express";
import { ApiError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { guardianService } from "./guardian.service";

const respondWithError = (res: Response, error: unknown, logTag: string) => {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }
  // eslint-disable-next-line no-console
  console.error(logTag, error);
  return res
    .status(HttpStatus.INTERNAL_SERVER_ERROR)
    .json({ success: false, message: (error as Error)?.message || "Something went wrong" });
};

export const guardianLogin = async (req: Request, res: Response) => {
  try {
    const { phone, password } = req.body;
    const madrasa_id = req.tenant!.madrasa_id;
    const result = await guardianService.login(phone, password, madrasa_id);
    res.json({ success: true, ...result });
  } catch (err) {
    respondWithError(res, err, "GUARDIAN LOGIN ERROR:");
  }
};

export const guardianChangePassword = async (req: Request, res: Response) => {
  try {
    const madrasa_id = req.tenant!.madrasa_id;
    const guardianId = req.guardian!.guardianId;
    await guardianService.changePassword(guardianId, madrasa_id, req.body.new_password);
    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    respondWithError(res, err, "GUARDIAN CHANGE PASSWORD ERROR:");
  }
};

export const getMyChildren = async (req: Request, res: Response) => {
  try {
    const madrasa_id = req.tenant!.madrasa_id;
    const guardianId = req.guardian!.guardianId;
    const data = await guardianService.listMyChildren(guardianId, madrasa_id);
    res.json({ success: true, data });
  } catch (err) {
    respondWithError(res, err, "GUARDIAN CHILDREN ERROR:");
  }
};

export const getChildAttendance = async (req: Request, res: Response) => {
  try {
    const madrasa_id = req.tenant!.madrasa_id;
    const guardianId = req.guardian!.guardianId;
    const studentId = Number(req.params.studentId);
    const month = req.query.month ? String(req.query.month) : undefined;
    const data = await guardianService.getChildAttendance(guardianId, madrasa_id, studentId, month);
    res.json({ success: true, data });
  } catch (err) {
    respondWithError(res, err, "GUARDIAN ATTENDANCE ERROR:");
  }
};

export const getChildResults = async (req: Request, res: Response) => {
  try {
    const madrasa_id = req.tenant!.madrasa_id;
    const guardianId = req.guardian!.guardianId;
    const studentId = Number(req.params.studentId);
    const data = await guardianService.getChildResults(guardianId, madrasa_id, studentId);
    res.json({ success: true, data });
  } catch (err) {
    respondWithError(res, err, "GUARDIAN RESULTS ERROR:");
  }
};

export const getChildFees = async (req: Request, res: Response) => {
  try {
    const madrasa_id = req.tenant!.madrasa_id;
    const guardianId = req.guardian!.guardianId;
    const studentId = Number(req.params.studentId);
    const data = await guardianService.getChildFees(guardianId, madrasa_id, studentId);
    res.json({ success: true, data });
  } catch (err) {
    respondWithError(res, err, "GUARDIAN FEES ERROR:");
  }
};

export const getNotices = async (req: Request, res: Response) => {
  try {
    const madrasa_id = req.tenant!.madrasa_id;
    const guardianId = req.guardian!.guardianId;
    const data = await guardianService.getNotices(guardianId, madrasa_id);
    res.json({ success: true, data });
  } catch (err) {
    respondWithError(res, err, "GUARDIAN NOTICES ERROR:");
  }
};
