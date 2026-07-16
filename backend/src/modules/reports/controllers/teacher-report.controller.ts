import { Request, Response } from "express";
import { fail, ok, requireTenant } from "../reports.response";
import { teacherReportService } from "./teacher-report.service";

export const getTeacherListReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const rows = await teacherReportService.getList(madrasaId);
    return ok(res, Array.isArray(rows) ? rows : []);
  } catch (error) {
    return fail(res, error);
  }
};

export const getTeacherPhoneReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const rows = await teacherReportService.getPhones(madrasaId);
    return ok(res, Array.isArray(rows) ? rows : []);
  } catch (error) {
    return fail(res, error);
  }
};
