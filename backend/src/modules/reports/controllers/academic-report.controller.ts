import { Request, Response } from "express";
import { fail, ok, requireTenant } from "../reports.response";
import { academicReportService } from "./academic-report.service";

export const getAcademicResultsReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const { rows, warning } = await academicReportService.getResults(madrasaId);
    return ok(res, rows, warning);
  } catch (error) {
    return fail(res, error);
  }
};

export const getAcademicResultNoticeReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const { rows, warning } = await academicReportService.getResultNotice(madrasaId);
    return ok(res, rows, warning);
  } catch (error) {
    return fail(res, error);
  }
};

export const getAcademicRoutineReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const { rows, warning } = await academicReportService.getRoutines(madrasaId);
    return ok(res, rows, warning);
  } catch (error) {
    return fail(res, error);
  }
};

export const getAcademicAdmissionReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const rows = await academicReportService.getAdmissions(madrasaId);
    return ok(res, Array.isArray(rows) ? rows : []);
  } catch (error) {
    return fail(res, error);
  }
};

export const getGuardianPhoneReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const rows = await academicReportService.getGuardianPhones(madrasaId);
    return ok(res, Array.isArray(rows) ? rows : []);
  } catch (error) {
    return fail(res, error);
  }
};

export const getResidentialAttendanceReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const rows = await academicReportService.getResidentialAttendance(madrasaId);
    return ok(res, Array.isArray(rows) ? rows : []);
  } catch (error) {
    return fail(res, error);
  }
};

export const getDailyAttendanceReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const { rows, warning } = await academicReportService.getDailyAttendance(madrasaId);
    return ok(res, rows, warning);
  } catch (error) {
    return fail(res, error);
  }
};

export const getDigitalAttendanceReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const { rows, warning } = await academicReportService.getDigitalAttendance(madrasaId);
    return ok(res, rows, warning);
  } catch (error) {
    return fail(res, error);
  }
};

const getOptionalExamId = (req: Request) => {
  const examId = Number(req.query.exam_id);
  return Number.isInteger(examId) && examId > 0 ? examId : undefined;
};

export const getExamSignatureSheetReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const rows = await academicReportService.getExamSignatureSheet(
      madrasaId,
      getOptionalExamId(req),
    );
    return ok(res, Array.isArray(rows) ? rows : []);
  } catch (error) {
    return fail(res, error);
  }
};

export const getExamNumberSheetReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const rows = await academicReportService.getExamNumberSheet(madrasaId, getOptionalExamId(req));
    return ok(res, Array.isArray(rows) ? rows : []);
  } catch (error) {
    return fail(res, error);
  }
};
