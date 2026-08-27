import { Request, Response } from "express";
import { ApiError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { logger } from "../../shared/logger/logger";
import { vendorPromoService } from "./vendor-promo.service";

const respondError = (res: Response, error: unknown, logTag: string, fallbackMessage: string) => {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  logger.error(logTag, error);
  return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: fallbackMessage });
};

export const getVendorPromoConfig = async (_req: Request, res: Response) => {
  try {
    const data = await vendorPromoService.getConfig();
    res.json({ data });
  } catch (err) {
    respondError(res, err, "getVendorPromoConfig ERROR:", "Failed to load vendor promo config");
  }
};

export const saveVendorPromoConfig = async (req: Request, res: Response) => {
  try {
    await vendorPromoService.saveConfig(req.body);
    res.json({ message: "সেভ হয়েছে" });
  } catch (err) {
    respondError(res, err, "saveVendorPromoConfig ERROR:", "Failed to save vendor promo config");
  }
};

export const listVendorServices = async (_req: Request, res: Response) => {
  try {
    const data = await vendorPromoService.listServices();
    res.json({ data });
  } catch (err) {
    respondError(res, err, "listVendorServices ERROR:", "Failed to load vendor services");
  }
};

export const createVendorService = async (req: Request, res: Response) => {
  try {
    const row = await vendorPromoService.createService(req.body);
    res.status(HttpStatus.CREATED).json({ message: "সার্ভিস তৈরি হয়েছে", id: row.id });
  } catch (err) {
    respondError(res, err, "createVendorService ERROR:", "Failed to create vendor service");
  }
};

export const updateVendorService = async (req: Request, res: Response) => {
  try {
    await vendorPromoService.updateService(Number(req.params.id), req.body);
    res.json({ message: "সার্ভিস আপডেট হয়েছে" });
  } catch (err) {
    respondError(res, err, "updateVendorService ERROR:", "Failed to update vendor service");
  }
};

export const deleteVendorService = async (req: Request, res: Response) => {
  try {
    await vendorPromoService.deleteService(Number(req.params.id));
    res.json({ message: "সার্ভিস মুছে ফেলা হয়েছে" });
  } catch (err) {
    respondError(res, err, "deleteVendorService ERROR:", "Failed to delete vendor service");
  }
};

export const reorderVendorServices = async (req: Request, res: Response) => {
  try {
    const ids = (Array.isArray(req.body?.service_ids) ? req.body.service_ids : []).map(Number);
    await vendorPromoService.reorderServices(ids);
    res.json({ message: "ক্রম সংরক্ষণ করা হয়েছে" });
  } catch (err) {
    respondError(res, err, "reorderVendorServices ERROR:", "Failed to reorder vendor services");
  }
};

/** Tenant-facing (mounted under dashboard.routes.ts, normal tenant auth) -
 * what the Dashboard promo card + HikmahItPage render. */
export const getPublicVendorPromo = async (_req: Request, res: Response) => {
  try {
    const data = await vendorPromoService.getPublicPayload();
    res.json({ data });
  } catch (err) {
    respondError(res, err, "getPublicVendorPromo ERROR:", "Failed to load vendor promo");
  }
};
