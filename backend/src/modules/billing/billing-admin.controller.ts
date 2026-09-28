import { Request, Response } from "express";
import { ApiError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { logger } from "../../shared/logger/logger";
import { billingService } from "./billing.service";
import { isBillingChannel } from "./billing.types";
import { t } from "../../shared/i18n";

const respondError = (res: Response, error: unknown, logTag: string) => {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  logger.error(logTag, error);
  return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: (error as Error)?.message });
};

const channelParam = (value: unknown) => {
  const channel = String(value || "").toUpperCase();
  if (!isBillingChannel(channel)) throw new ApiError(t({ bn: "channel অবশ্যই SMS অথবা EMAIL হতে হবে", en: "channel must be SMS or EMAIL" }), HttpStatus.BAD_REQUEST);
  return channel;
};

/* ================= PACKAGES ================= */

export const listPackagesAdmin = async (req: Request, res: Response) => {
  try {
    const channel = req.query.channel ? channelParam(req.query.channel) : undefined;
    const data = await billingService.listPackagesAdmin(channel);
    res.json({ data });
  } catch (error) {
    respondError(res, error, "listPackagesAdmin ERROR:");
  }
};

export const createPackageAdmin = async (req: Request, res: Response) => {
  try {
    const data = await billingService.createPackageAdmin(req.body, req.user?.id);
    res.status(HttpStatus.CREATED).json({ message: t({ bn: "প্যাকেজ তৈরি হয়েছে", en: "Package created" }), data });
  } catch (error) {
    respondError(res, error, "createPackageAdmin ERROR:");
  }
};

export const updatePackageAdmin = async (req: Request, res: Response) => {
  try {
    await billingService.updatePackageAdmin(Number(req.params.id), req.body, req.user?.id);
    res.json({ message: t({ bn: "প্যাকেজ আপডেট হয়েছে", en: "Package updated" }) });
  } catch (error) {
    respondError(res, error, "updatePackageAdmin ERROR:");
  }
};

export const togglePackageAdmin = async (req: Request, res: Response) => {
  try {
    await billingService.togglePackageAdmin(Number(req.params.id));
    res.json({ message: t({ bn: "প্যাকেজের স্ট্যাটাস পরিবর্তন হয়েছে", en: "Package status changed" }) });
  } catch (error) {
    respondError(res, error, "togglePackageAdmin ERROR:");
  }
};

export const deletePackageAdmin = async (req: Request, res: Response) => {
  try {
    await billingService.deletePackageAdmin(Number(req.params.id));
    res.json({ message: t({ bn: "প্যাকেজ ডিলিট হয়েছে", en: "Package deleted" }) });
  } catch (error) {
    respondError(res, error, "deletePackageAdmin ERROR:");
  }
};

/* ================= PRICING ================= */

export const getPricingAdmin = async (_req: Request, res: Response) => {
  try {
    const data = await billingService.getGlobalPricingAdmin();
    res.json({ data });
  } catch (error) {
    respondError(res, error, "getPricingAdmin ERROR:");
  }
};

export const setPricingAdmin = async (req: Request, res: Response) => {
  try {
    const channel = channelParam(req.params.channel);
    const data = await billingService.setGlobalPricingAdmin(channel, req.body);
    res.json({ message: t({ bn: "প্রাইসিং সংরক্ষণ হয়েছে", en: "Pricing saved" }), data });
  } catch (error) {
    respondError(res, error, "setPricingAdmin ERROR:");
  }
};

export const setPricingOverrideAdmin = async (req: Request, res: Response) => {
  try {
    const channel = channelParam(req.params.channel);
    const madrasaId = Number(req.params.madrasaId);
    const data = await billingService.setPricingOverrideAdmin(madrasaId, channel, req.body.sellingPrice);
    res.json({ message: t({ bn: "কাস্টম প্রাইস সংরক্ষণ হয়েছে", en: "Custom price saved" }), data });
  } catch (error) {
    respondError(res, error, "setPricingOverrideAdmin ERROR:");
  }
};

export const deletePricingOverrideAdmin = async (req: Request, res: Response) => {
  try {
    const channel = channelParam(req.params.channel);
    const madrasaId = Number(req.params.madrasaId);
    await billingService.deletePricingOverrideAdmin(madrasaId, channel);
    res.json({ message: t({ bn: "কাস্টম প্রাইস মুছে ফেলা হয়েছে", en: "Custom price removed" }) });
  } catch (error) {
    respondError(res, error, "deletePricingOverrideAdmin ERROR:");
  }
};

/* ================= PURCHASE REQUESTS ================= */

export const listPurchaseRequestsAdmin = async (req: Request, res: Response) => {
  try {
    const status = req.query.status ? (String(req.query.status).toUpperCase() as "PENDING" | "APPROVED" | "REJECTED") : undefined;
    const data = await billingService.listAllPurchaseRequests(status, Number(req.query.limit) || 100);
    res.json({ data });
  } catch (error) {
    respondError(res, error, "listPurchaseRequestsAdmin ERROR:");
  }
};

export const approvePurchaseRequestAdmin = async (req: Request, res: Response) => {
  try {
    await billingService.approvePurchaseRequest(Number(req.params.id), req.user?.id, req.body?.reviewNote);
    res.json({ message: t({ bn: "অনুরোধ অনুমোদিত হয়েছে এবং ক্রেডিট যোগ হয়েছে", en: "Request approved and credit added" }) });
  } catch (error) {
    respondError(res, error, "approvePurchaseRequestAdmin ERROR:");
  }
};

export const rejectPurchaseRequestAdmin = async (req: Request, res: Response) => {
  try {
    await billingService.rejectPurchaseRequest(Number(req.params.id), req.user?.id, req.body?.reviewNote);
    res.json({ message: t({ bn: "অনুরোধ প্রত্যাখ্যান করা হয়েছে", en: "Request rejected" }) });
  } catch (error) {
    respondError(res, error, "rejectPurchaseRequestAdmin ERROR:");
  }
};

/* ================= MANUAL CREDIT ================= */

export const manualAdjustCreditAdmin = async (req: Request, res: Response) => {
  try {
    const channel = channelParam(req.body.channel);
    const madrasaId = Number(req.params.madrasaId);
    const delta = Number(req.body.delta);
    const data = await billingService.manualAdjustCredit(madrasaId, channel, delta, req.body.note, req.user?.id);
    res.json({ message: t({ bn: "ক্রেডিট সমন্বয় হয়েছে", en: "Credit adjusted" }), data });
  } catch (error) {
    respondError(res, error, "manualAdjustCreditAdmin ERROR:");
  }
};

/* ================= TENANT VIEW (support) ================= */

export const getMadrasaSubscriptionsAdmin = async (req: Request, res: Response) => {
  try {
    const data = await billingService.getMadrasaSubscriptions(Number(req.params.madrasaId));
    res.json({ data });
  } catch (error) {
    respondError(res, error, "getMadrasaSubscriptionsAdmin ERROR:");
  }
};

export const getMadrasaUsageAdmin = async (req: Request, res: Response) => {
  try {
    const channel = req.query.channel ? channelParam(req.query.channel) : undefined;
    const data = await billingService.getMadrasaUsage(Number(req.params.madrasaId), channel, Number(req.query.limit) || 100);
    res.json({ data });
  } catch (error) {
    respondError(res, error, "getMadrasaUsageAdmin ERROR:");
  }
};

export const getMadrasaTransactionsAdmin = async (req: Request, res: Response) => {
  try {
    const channel = req.query.channel ? channelParam(req.query.channel) : undefined;
    const data = await billingService.getMadrasaTransactions(Number(req.params.madrasaId), channel, Number(req.query.limit) || 100);
    res.json({ data });
  } catch (error) {
    respondError(res, error, "getMadrasaTransactionsAdmin ERROR:");
  }
};

/* ================= REPORTING ================= */

export const getReportAdmin = async (req: Request, res: Response) => {
  try {
    const channel = channelParam(req.query.channel);
    const data = await billingService.getReport(channel);
    res.json({ data });
  } catch (error) {
    respondError(res, error, "getReportAdmin ERROR:");
  }
};
