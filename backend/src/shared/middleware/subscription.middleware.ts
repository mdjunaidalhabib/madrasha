import { Request, Response, NextFunction } from "express";
import { prisma } from "../database/prisma";
import { asyncHandler } from "../utils/async-handler.util";
import { t } from "../i18n";

export const subscriptionCheck = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const madrasa_id = req.tenant!.madrasa_id;
    const subscription = await prisma.madrasaSubscription.findFirst({
      where: { madrasaId: madrasa_id, isActive: 1 },
      select: { endDate: true },
    });
    if (!subscription) return res.status(403).json({ message: t({ bn: "কোনো সক্রিয় সাবস্ক্রিপশন নেই", en: "No active subscription", ar: "لا يوجد اشتراك نشط" }) });

    const today = new Date();
    const expiry = subscription.endDate ? new Date(subscription.endDate) : null;
    if (expiry && today > expiry)
      return res.status(403).json({ message: t({ bn: "সাবস্ক্রিপশনের মেয়াদ শেষ। অনুগ্রহ করে আপগ্রেড করুন।", en: "Subscription expired. Please upgrade.", ar: "انتهى الاشتراك. يرجى الترقية." }) });

    _next();
  },
);
