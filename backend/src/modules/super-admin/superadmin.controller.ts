import { Request, Response } from "express";
import { ApiError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { logger } from "../../shared/logger/logger";
import { superAdminService } from "./superadmin.service";

const respondError = (res: Response, error: unknown, logTag?: string) => {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  if (logTag) logger.error(logTag, error);
  return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: (error as Error)?.message });
};

/* ================= LIST ACTIVE MADRASAS ================= */
export const listMadrasas = async (req: Request, res: Response) => {
  try {
    const { rows, meta } = await superAdminService.listMadrasas(req.query);
    res.json({ data: rows, meta });
  } catch (error) {
    respondError(res, error);
  }
};

/* ================= LIST PLANS ================= */
export const listPlans = async (_req: Request, res: Response) => {
  try {
    const rows = await superAdminService.listPlans();
    res.json({ data: rows });
  } catch (error) {
    respondError(res, error);
  }
};

/* ================= ASSIGN PLAN ================= */
export const assignPlanToMadrasa = async (req: Request, res: Response) => {
  try {
    await superAdminService.assignPlanToMadrasa(Number(req.params.id), req.body);
    res.json({ message: "Plan assigned successfully" });
  } catch (error) {
    respondError(res, error);
  }
};

/* ================= CREATE MADRASA ================= */
export const createMadrasa = async (req: Request, res: Response) => {
  try {
    const result = await superAdminService.createMadrasa(req.body);
    res.status(HttpStatus.CREATED).json({
      message: "Madrasa created successfully",
      madrasa_id: result.madrasaId,
      slug: result.finalSlug,
    });
  } catch (error) {
    respondError(res, error);
  }
};

/* ================= UPDATE MADRASA ================= */
export const updateMadrasa = async (req: Request, res: Response) => {
  try {
    await superAdminService.updateMadrasa(Number(req.params.id), req.body);
    res.json({ message: "Madrasa updated successfully" });
  } catch (error) {
    respondError(res, error);
  }
};

/* ================= ACTIVATE / SUSPEND ================= */
export const activateMadrasa = async (req: Request, res: Response) => {
  try {
    await superAdminService.activateMadrasa(Number(req.params.id));
    res.json({ message: "Activated" });
  } catch (error) {
    respondError(res, error);
  }
};

export const suspendMadrasa = async (req: Request, res: Response) => {
  try {
    await superAdminService.suspendMadrasa(Number(req.params.id));
    res.json({ message: "Suspended" });
  } catch (error) {
    respondError(res, error);
  }
};

/* ================= SOFT DELETE ================= */
export const trashMadrasa = async (req: Request, res: Response) => {
  try {
    await superAdminService.trashMadrasa(Number(req.params.id));
    res.json({ message: "Moved to trash and suspended" });
  } catch (error) {
    respondError(res, error);
  }
};

/* ================= LIST TRASH ================= */
export const listTrash = async (_req: Request, res: Response) => {
  try {
    const rows = await superAdminService.listTrash();
    res.json({ data: rows });
  } catch (error) {
    respondError(res, error);
  }
};

/* ================= RESTORE (Auto Activate) ================= */
export const restoreMadrasa = async (req: Request, res: Response) => {
  try {
    await superAdminService.restoreMadrasa(Number(req.params.id));
    res.json({ message: "Restored successfully" });
  } catch (error) {
    respondError(res, error);
  }
};

/* ================= DELETE STATS (Before Permanent Delete) ================= */
export const getMadrasaDeleteStats = async (req: Request, res: Response) => {
  try {
    const stats = await superAdminService.getMadrasaDeleteStats(Number(req.params.id));
    res.json(stats);
  } catch (error) {
    respondError(res, error);
  }
};

/* ================= SUPER ADMIN DASHBOARD STATS ================= */
export const getSuperAdminStats = async (_req: Request, res: Response) => {
  try {
    const stats = await superAdminService.getSuperAdminStats();
    res.json(stats);
  } catch (error) {
    respondError(res, error);
  }
};

/* ================= PERMANENT DELETE ================= */
export const permanentDeleteMadrasa = async (req: Request, res: Response) => {
  try {
    await superAdminService.permanentDeleteMadrasa(Number(req.params.id));
    res.json({ message: "Permanently deleted" });
  } catch (error) {
    respondError(res, error, "Permanent delete error:");
  }
};
