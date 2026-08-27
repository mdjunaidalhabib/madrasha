import { Request, Response } from "express";
import { fail, getDivisionClassFilters, ok, requireTenant } from "../reports.response";
import { studentReportService } from "./student-report.service";

export const getStudentIdCardsReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const rows = await studentReportService.getIdCards(madrasaId, getDivisionClassFilters(req));
    return ok(res, Array.isArray(rows) ? rows : []);
  } catch (error) {
    return fail(res, error);
  }
};

export const getStudentMarksheetsReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const { rows, warning } = await studentReportService.getMarksheets(madrasaId, getDivisionClassFilters(req));
    return ok(res, rows, warning);
  } catch (error) {
    return fail(res, error);
  }
};

export const getStudentCertificatesReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const rows = await studentReportService.getCertificates(madrasaId, getDivisionClassFilters(req));
    return ok(res, Array.isArray(rows) ? rows : []);
  } catch (error) {
    return fail(res, error);
  }
};

export const getStudentAdmitCardsReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const { rows, warning } = await studentReportService.getAdmitCards(madrasaId, getDivisionClassFilters(req));
    return ok(res, rows, warning);
  } catch (error) {
    return fail(res, error);
  }
};

export const getStudentSanadsReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const { rows, warning } = await studentReportService.getSanads(madrasaId, getDivisionClassFilters(req));
    return ok(res, rows, warning);
  } catch (error) {
    return fail(res, error);
  }
};

export const getStudentTransferLettersReport = async (req: Request, res: Response) => {
  const madrasaId = requireTenant(req, res);
  if (!madrasaId) return;

  try {
    const rows = await studentReportService.getTransferLetters(madrasaId, getDivisionClassFilters(req));
    return ok(res, Array.isArray(rows) ? rows : []);
  } catch (error) {
    return fail(res, error);
  }
};
