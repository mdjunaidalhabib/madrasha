import { RequestHandler } from "express";
import { BadRequestError } from "../../shared/errors";
import { t } from "../../shared/i18n";
import { subscriptionsService } from "./subscriptions.service";
import { domainSubscriptionsService } from "./domain-subscriptions.service";

const id = (value: string) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0)
    throw new BadRequestError(t({ bn: "আইডি সঠিক নয়।", en: "Invalid ID." }));
  return number;
};
const handle =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
export const renewSubscription = handle(async (req, res) => {
  res.json({ data: await subscriptionsService.purchase(id(req.params.id), req.body) });
});
export const cancelAndRefund = handle(async (req, res) => {
  res.json({
    data: await subscriptionsService.cancelAndRefund(
      id(req.params.id),
      id(req.params.subscriptionId),
    ),
  });
});
export const listExpiredSubscriptions = handle(async (_req, res) => {
  res.json({ data: await subscriptionsService.listExpired() });
});
export const listDomainSubscriptions = handle(async (req, res) => {
  res.json({ data: await domainSubscriptionsService.list(id(req.params.id)) });
});
export const createDomainSubscription = handle(async (req, res) => {
  res
    .status(201)
    .json({ data: await domainSubscriptionsService.save(id(req.params.id), req.body) });
});
export const updateDomainSubscription = handle(async (req, res) => {
  res.json({
    data: await domainSubscriptionsService.save(
      id(req.params.id),
      req.body,
      id(req.params.domainId),
    ),
  });
});
export const removeDomainSubscription = handle(async (req, res) => {
  await domainSubscriptionsService.remove(id(req.params.id), id(req.params.domainId));
  res.json({ message: t({ bn: "ডোমেইন সংযোগ সরানো হয়েছে।", en: "Domain disconnected." }) });
});
