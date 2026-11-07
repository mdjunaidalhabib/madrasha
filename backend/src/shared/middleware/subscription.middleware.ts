import { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../utils/async-handler.util";
import { getSubscriptionState, subscriptionSuspendedBody } from "../subscription/subscription-state";

/**
 * Per-router subscription check (requires tenantMiddleware to have run first).
 *
 * NOTE: tenantMiddleware itself now auto-suspends a madrasa whose plan has
 * expired (423), so on every tenant route this is already enforced before we
 * get here. This stays as a defensive second layer for routers that read
 * req.tenant without going through tenantMiddleware.
 */
export const subscriptionCheck = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const state = await getSubscriptionState(req.tenant!.madrasa_id);
  if (state !== "ACTIVE") {
    return res.status(423).json(await subscriptionSuspendedBody(req.tenant!.madrasa_id));
  }
  next();
});
