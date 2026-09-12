import { Request, Response } from "express";
import { AcademicResultFilters } from "../reports.repository";
import { fail, getDivisionClassFilters, getOptionalExamId, ok, requireTenant } from "../reports.response";
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

export const getExamRoutineReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const rows = await academicReportService.getExamRoutine(
      madrasaId,
      getOptionalExamId(req),
      getDivisionClassFilters(req),
    );
    return ok(res, Array.isArray(rows) ? rows : []);
  } catch (error) {
    return fail(res, error);
  }
};

export const getExamRoutineByRoomReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const rows = await academicReportService.getExamRoutineByRoom(
      madrasaId,
      getOptionalExamId(req),
      getDivisionClassFilters(req),
    );
    return ok(res, Array.isArray(rows) ? rows : []);
  } catch (error) {
    return fail(res, error);
  }
};

export const getSeatPlanReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const { divisionId, classId } = getDivisionClassFilters(req);
    const rows = await academicReportService.getSeatPlan(madrasaId, getOptionalExamId(req), {
      roomId: getOptionalPositiveInt(req.query.room_id),
      classId,
      divisionId,
    });
    return ok(res, Array.isArray(rows) ? rows : []);
  } catch (error) {
    return fail(res, error);
  }
};

export const getInvigilatorListReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const rows = await academicReportService.getInvigilatorList(madrasaId, getOptionalExamId(req), {
      roomId: getOptionalPositiveInt(req.query.room_id),
    });
    return ok(res, Array.isArray(rows) ? rows : []);
  } catch (error) {
    return fail(res, error);
  }
};

export const getExamAttendanceSheetReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const { divisionId, classId } = getDivisionClassFilters(req);
    const rows = await academicReportService.getExamAttendanceSheet(madrasaId, getOptionalExamId(req), {
      roomId: getOptionalPositiveInt(req.query.room_id),
      classId,
      divisionId,
    });
    return ok(res, Array.isArray(rows) ? rows : []);
  } catch (error) {
    return fail(res, error);
  }
};

export const getExamCandidatesReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const { rows, warning } = await academicReportService.getExamCandidates(
      madrasaId,
      getOptionalExamId(req),
      getDivisionClassFilters(req),
    );
    return ok(res, rows, warning);
  } catch (error) {
    return fail(res, error);
  }
};

export const getAbsentCandidatesReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const rows = await academicReportService.getAbsentCandidates(
      madrasaId,
      getOptionalExamId(req),
      getDivisionClassFilters(req),
    );
    return ok(res, Array.isArray(rows) ? rows : []);
  } catch (error) {
    return fail(res, error);
  }
};

/** Shared by the ফেল/পাশ তালিকা report pair - which list comes back is
 * decided by `?status=PASS|FAIL` (see ExamReportPage/AcademicReportPage's
 * extraParams), not two separate endpoints. Defaults to FAIL if the query
 * param is missing/invalid so a stray request never silently returns PASS
 * rows under a FAIL label. */
export const getResultsByStatusReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const status = req.query.status === "PASS" ? "PASS" : "FAIL";
    const examId = getOptionalExamId(req);
    const rows = await academicReportService.getResultsByStatus(madrasaId, status, {
      examId,
      ...getDivisionClassFilters(req),
    });
    return ok(res, Array.isArray(rows) ? rows : []);
  } catch (error) {
    return fail(res, error);
  }
};

export const getSubjectPerformanceReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const examId = getOptionalExamId(req);
    const rows = await academicReportService.getSubjectPerformance(madrasaId, {
      examId,
      ...getDivisionClassFilters(req),
    });
    return ok(res, Array.isArray(rows) ? rows : []);
  } catch (error) {
    return fail(res, error);
  }
};

export const getExamSummaryReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const examId = getOptionalExamId(req);
    const rows = await academicReportService.getExamSummary(madrasaId, {
      examId,
      ...getDivisionClassFilters(req),
    });
    return ok(res, Array.isArray(rows) ? rows : []);
  } catch (error) {
    return fail(res, error);
  }
};

export const getResultPublicationReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const rows = await academicReportService.getResultPublicationStatus(
      madrasaId,
      getDivisionClassFilters(req),
    );
    return ok(res, Array.isArray(rows) ? rows : []);
  } catch (error) {
    return fail(res, error);
  }
};
