import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { BadRequestError, TenantNotFoundInRequestError } from "../../shared/errors";
import { billingService } from "./billing.service";
import { isBillingChannel } from "./billing.types";

const getMadrasaId = (req: Request): number => {
  const madrasaId = req.tenant?.madrasa_id;
  if (!madrasaId) throw new TenantNotFoundInRequestError();
  return Number(madrasaId);
};

const getChannelParam = (value: unknown) => {
  const channel = String(value || "").toUpperCase();
  if (!isBillingChannel(channel)) throw new BadRequestError("channel must be SMS or EMAIL");
  return channel;
};

export const listPackages = asyncHandler(async (req: Request, res: Response) => {
  const channel = getChannelParam(req.query.channel);
  const data = await billingService.listPackages(channel);
  return ApiResponse.success(res, { data });
});

export const getSubscriptions = asyncHandler(async (req: Request, res: Response) => {
  const data = await billingService.getAllSubscriptionSummaries(getMadrasaId(req));
  return ApiResponse.success(res, { data });
});

export const getSubscription = asyncHandler(async (req: Request, res: Response) => {
  const channel = getChannelParam(req.query.channel);
  const data = await billingService.getSubscriptionSummary(getMadrasaId(req), channel);
  return ApiResponse.success(res, { data });
});

export const previewSms = asyncHandler(async (req: Request, res: Response) => {
  const message = String(req.body?.message || "");
  const data = await billingService.previewSms(getMadrasaId(req), message);
  return ApiResponse.success(res, { data });
});

export const getTransactions = asyncHandler(async (req: Request, res: Response) => {
  const channelRaw = req.query.channel ? getChannelParam(req.query.channel) : undefined;
  const data = await billingService.findTransactions(getMadrasaId(req), channelRaw, Number(req.query.limit) || 50);
  return ApiResponse.success(res, { data });
});

export const getUsage = asyncHandler(async (req: Request, res: Response) => {
  const channelRaw = req.query.channel ? getChannelParam(req.query.channel) : undefined;
  const data = await billingService.findUsageLogs(getMadrasaId(req), channelRaw, Number(req.query.limit) || 50);
  return ApiResponse.success(res, { data });
});

export const createPurchaseRequest = asyncHandler(async (req: Request, res: Response) => {
  const data = await billingService.createPurchaseRequest(getMadrasaId(req), req.user?.id, req.body);
  return ApiResponse.success(res, { message: "আপনার অনুরোধ পাঠানো হয়েছে - Super Admin approve করলে credit যোগ হবে", data });
});

export const getMyPurchaseRequests = asyncHandler(async (req: Request, res: Response) => {
  const data = await billingService.listMyPurchaseRequests(getMadrasaId(req), Number(req.query.limit) || 50);
  return ApiResponse.success(res, { data });
});
