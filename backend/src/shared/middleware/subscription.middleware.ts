import { Request, Response, NextFunction } from "express";
import { prisma } from "../database/prisma";
import { asyncHandler } from "../utils/async-handler.util";

export const subscriptionCheck = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const madrasa_id = req.tenant!.madrasa_id;
    const subscription = await prisma.madrasaSubscription.findFirst({
      where: { madrasaId: madrasa_id, isActive: 1 },
      select: { endDate: true },
    });
    if (!subscription) return res.status(403).json({ message: "No active subscription" });

    const today = new Date();
    const expiry = subscription.endDate ? new Date(subscription.endDate) : null;
    if (expiry && today > expiry)
      return res.status(403).json({ message: "Subscription expired. Please upgrade." });

    _next();
  },
);
