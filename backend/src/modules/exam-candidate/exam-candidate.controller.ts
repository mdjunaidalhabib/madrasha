import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { TenantNotFoundInRequestError } from "../../shared/errors";
import { examCandidateService } from "./exam-candidate.service";

const getMadrasaId = (req: Request): number => {
  const madrasaId = req.tenant?.madrasa_id;
  if (!madrasaId) throw new TenantNotFoundInRequestError();
  return Number(madrasaId);
};

/* ================= LIST / DETAIL ================= */

export const listExamCandidates = asyncHandler(async (req: Request, res: Response) => {
  const data = await examCandidateService.list(getMadrasaId(req), req.query as any);
  return ApiResponse.paginated(res, data.rows, {
    page: data.page,
    limit: data.limit,
    total: data.total,
    totalPages: data.totalPages,
  });
});

export const getExamCandidate = asyncHandler(async (req: Request, res: Response) => {
  const data = await examCandidateService.getById(getMadrasaId(req), Number(req.params.id));
  res.json({ success: true, data });
});

export const getEligibleStudents = asyncHandler(async (req: Request, res: Response) => {
  const data = await examCandidateService.eligibleStudents(getMadrasaId(req), req.query as any);
  res.json({ success: true, data });
});

/* ================= REGISTRATION ================= */

export const registerCandidate = asyncHandler(async (req: Request, res: Response) => {
  const data = await examCandidateService.register(getMadrasaId(req), req.user?.id, req.body);
  return ApiResponse.created(res, data, "Candidate registered successfully");
});

export const bulkRegisterCandidates = asyncHandler(async (req: Request, res: Response) => {
  const data = await examCandidateService.bulkRegister(getMadrasaId(req), req.user?.id, req.body);
  res.json({ success: true, data });
});

/* ================= ELIGIBILITY ================= */

export const checkEligibility = asyncHandler(async (req: Request, res: Response) => {
  const data = await examCandidateService.checkEligibility(getMadrasaId(req), req.body);
  res.json({ success: true, data });
});

export const bulkCheckEligibility = asyncHandler(async (req: Request, res: Response) => {
  const data = await examCandidateService.bulkCheckEligibility(getMadrasaId(req), req.body);
  res.json({ success: true, data });
});

export const getEligibilitySettings = asyncHandler(async (req: Request, res: Response) => {
  const data = await examCandidateService.getEligibilitySettings(getMadrasaId(req));
  res.json({ success: true, data });
});

export const updateEligibilitySettings = asyncHandler(async (req: Request, res: Response) => {
  const data = await examCandidateService.updateEligibilitySettings(getMadrasaId(req), req.body);
  res.json({ success: true, data });
});

/* ================= STATUS ================= */

export const updateCandidateStatus = asyncHandler(async (req: Request, res: Response) => {
  await examCandidateService.updateStatus(getMadrasaId(req), Number(req.params.id), req.user?.id, req.body);
  return ApiResponse.message(res, "Candidate status updated successfully");
});

export const bulkUpdateCandidateStatus = asyncHandler(async (req: Request, res: Response) => {
  const data = await examCandidateService.bulkUpdateStatus(getMadrasaId(req), req.user?.id, req.body);
  res.json({ success: true, data });
});

export const cancelCandidate = asyncHandler(async (req: Request, res: Response) => {
  await examCandidateService.cancel(getMadrasaId(req), Number(req.params.id), req.user?.id);
  return ApiResponse.message(res, "Candidate registration cancelled successfully");
});
