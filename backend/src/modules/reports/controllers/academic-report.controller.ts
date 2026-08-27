import { Request, Response } from "express";
import { AcademicResultFilters } from "../reports.repository";
import { fail, getDivisionClassFilters, ok, requireTenant } from "../reports.response";
import { academicReportService } from "./academic-report.service";

const MAX_PAGE_SIZE = 500;
const DEFAULT_PAGE_SIZE = 100;

const getOptionalPositiveInt = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

/** Reads exam_id/division_id/class_id/page/page_size off req.query for the
 * two paginated academic-result endpoints. page_size is clamped to
 * MAX_PAGE_SIZE so a "সব" (all) selection on the frontend can't ask the
 * database for an unbounded result set. */
const getResultFilters = (req: Request): AcademicResultFilters => {
  const examId = getOptionalPositiveInt(req.query.exam_id);
  const classId = getOptionalPositiveInt(req.query.class_id);
  const divisionId = getOptionalPositiveInt(req.query.division_id);

  const page = getOptionalPositiveInt(req.query.page) ?? 1;
  const requestedPageSize = getOptionalPositiveInt(req.query.page_size) ?? DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE);

  return {
    examId,
    classId,
    divisionId,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };
};

const getTotal = (rows: any[]) =>
  rows.length && rows[0]?.total_count !== undefined ? Number(rows[0].total_count) : rows.length;

export const getAcademicResultsReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const { rows, warning } = await academicReportService.getResults(madrasaId, getResultFilters(req));
    return ok(res, rows, warning, getTotal(rows));
  } catch (error) {
    return fail(res, error);
  }
};

export const getAcademicResultsByRankReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const { rows, warning } = await academicReportService.getResultsByRank(
      madrasaId,
      getResultFilters(req),
    );
    return ok(res, rows, warning, getTotal(rows));
  } catch (error) {
    return fail(res, error);
  }
};

export const getAcademicResultNoticeReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const examId = getOptionalPositiveInt(req.query.exam_id);
    const { rows, warning } = await academicReportService.getResultNotice(madrasaId, {
      examId,
      ...getDivisionClassFilters(req),
    });
    return ok(res, rows, warning);
  } catch (error) {
    return fail(res, error);
  }
};

export const getAcademicRoutineReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const { rows, warning } = await academicReportService.getRoutines(
      madrasaId,
      getDivisionClassFilters(req),
    );
    return ok(res, rows, warning);
  } catch (error) {
    return fail(res, error);
  }
};

export const getAcademicAdmissionReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const rows = await academicReportService.getAdmissions(madrasaId, getDivisionClassFilters(req));
    return ok(res, Array.isArray(rows) ? rows : []);
  } catch (error) {
    return fail(res, error);
  }
};

export const getGuardianPhoneReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const rows = await academicReportService.getGuardianPhones(madrasaId, getDivisionClassFilters(req));
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

export const getPrizeBookLabelsReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const mumtazOnly = req.query.mumtaz_only === "true";
    const rows = await academicReportService.getPrizeBookLabels(
      madrasaId,
      getOptionalExamId(req),
      mumtazOnly,
      getDivisionClassFilters(req),
    );
    return ok(res, Array.isArray(rows) ? rows : []);
  } catch (error) {
    return fail(res, error);
  }
};

export const getExamSignatureSheetReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const rows = await academicReportService.getExamSignatureSheet(
      madrasaId,
      getOptionalExamId(req),
      getDivisionClassFilters(req),
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
    const rows = await academicReportService.getExamNumberSheet(
      madrasaId,
      getOptionalExamId(req),
      getDivisionClassFilters(req),
    );
    return ok(res, Array.isArray(rows) ? rows : []);
  } catch (error) {
    return fail(res, error);
  }
};
