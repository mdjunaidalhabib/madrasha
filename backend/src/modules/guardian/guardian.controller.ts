import { Request, Response } from "express";
import { ApiError, ValidationError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { guardianService } from "./guardian.service";
import { t } from "../../shared/i18n";
import {
  guardianCreateLeaveSchema,
  guardianListLeavesQuerySchema,
  parseDto,
} from "../attendance-leave/attendance-leave.dto";

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
    res.json({ success: true, message: t({ bn: "পাসওয়ার্ড আপডেট হয়েছে", en: "Password updated successfully" }) });
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

export const getChildResultDetail = async (req: Request, res: Response) => {
  try {
    const madrasa_id = req.tenant!.madrasa_id;
    const guardianId = req.guardian!.guardianId;
    const studentId = Number(req.params.studentId);
    const resultMasterId = Number(req.params.resultMasterId);
    const data = await guardianService.getChildResultDetail(guardianId, madrasa_id, studentId, resultMasterId);
    res.json({ success: true, data });
  } catch (err) {
    respondWithError(res, err, "GUARDIAN RESULT DETAIL ERROR:");
  }
};

export const getChildExamRoutine = async (req: Request, res: Response) => {
  try {
    const madrasa_id = req.tenant!.madrasa_id;
    const guardianId = req.guardian!.guardianId;
    const studentId = Number(req.params.studentId);
    const data = await guardianService.getChildExamRoutine(guardianId, madrasa_id, studentId);
    res.json({ success: true, data });
  } catch (err) {
    respondWithError(res, err, "GUARDIAN EXAM ROUTINE ERROR:");
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

export const getChildLibrary = async (req: Request, res: Response) => {
  try {
    const madrasa_id = req.tenant!.madrasa_id;
    const guardianId = req.guardian!.guardianId;
    const studentId = Number(req.params.studentId);
    const data = await guardianService.getChildLibrary(guardianId, madrasa_id, studentId);
    res.json({ success: true, data });
  } catch (err) {
    respondWithError(res, err, "GUARDIAN LIBRARY ERROR:");
  }
};

export const getChildPromotion = async (req: Request, res: Response) => {
  try {
    const madrasa_id = req.tenant!.madrasa_id;
    const guardianId = req.guardian!.guardianId;
    const studentId = Number(req.params.studentId);
    const data = await guardianService.getChildPromotion(guardianId, madrasa_id, studentId);
    res.json({ success: true, data });
  } catch (err) {
    respondWithError(res, err, "GUARDIAN PROMOTION ERROR:");
  }
};

export const getChildProfile360 = async (req: Request, res: Response) => {
  try {
    const madrasa_id = req.tenant!.madrasa_id;
    const guardianId = req.guardian!.guardianId;
    const studentId = Number(req.params.studentId);
    const data = await guardianService.getChildProfile360(guardianId, madrasa_id, studentId);
    res.json({ success: true, data });
  } catch (err) {
    respondWithError(res, err, "GUARDIAN PROFILE 360 ERROR:");
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

/* ================= LEAVE ================= */

export const getLeaves = async (req: Request, res: Response) => {
  try {
    const madrasa_id = req.tenant!.madrasa_id;
    const guardianId = req.guardian!.guardianId;
    const q = parseDto(guardianListLeavesQuerySchema, req.query);
    const data = await guardianService.listLeaves(guardianId, madrasa_id, q.student_id);
    res.json({ success: true, data });
  } catch (err) {
    respondWithError(res, err, "GUARDIAN LEAVES ERROR:");
  }
};

export const createLeave = async (req: Request, res: Response) => {
  try {
    const madrasa_id = req.tenant!.madrasa_id;
    const guardianId = req.guardian!.guardianId;
    const dto = parseDto(guardianCreateLeaveSchema, req.body);
    const data = await guardianService.createLeave(guardianId, madrasa_id, dto);
    res.status(HttpStatus.CREATED).json({
      success: true,
      message: t({ bn: "ছুটির আবেদন পাঠানো হয়েছে", en: "Leave request submitted" }),
      data,
    });
  } catch (err) {
    respondWithError(res, err, "GUARDIAN CREATE LEAVE ERROR:");
  }
};

export const cancelLeave = async (req: Request, res: Response) => {
  try {
    const madrasa_id = req.tenant!.madrasa_id;
    const guardianId = req.guardian!.guardianId;
    const leaveId = Number(req.params.id);
    if (!Number.isInteger(leaveId) || leaveId <= 0) {
      throw new ValidationError(t({ bn: "id সঠিক নয়", en: "id is invalid" }));
    }
    const data = await guardianService.cancelLeave(guardianId, madrasa_id, leaveId);
    res.json({ success: true, message: t({ bn: "ছুটির আবেদন বাতিল করা হয়েছে", en: "Leave request cancelled" }), data });
  } catch (err) {
    respondWithError(res, err, "GUARDIAN CANCEL LEAVE ERROR:");
  }
};
