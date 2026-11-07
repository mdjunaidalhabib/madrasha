import { prisma } from "../database/prisma";
import { DATA_RETENTION_WARNING_DAYS, retentionNotice } from "./subscription.constants";
import { t } from "../i18n";

export type SubscriptionState = "ACTIVE" | "NONE" | "EXPIRED";

const DAY_MS = 24 * 60 * 60 * 1000;
// Short TTL: this runs on every tenant request, so we avoid a DB hit each
// time, but a renewal by the super admin still takes effect quickly (and is
// cleared immediately via invalidateSubscriptionCache).
const CACHE_TTL_MS = 30_000;
const cache = new Map<number, { state: SubscriptionState; endDate: Date | null; expiresAt: number }>();

export const invalidateSubscriptionCache = (madrasaId?: number) => {
  if (madrasaId === undefined) cache.clear();
  else cache.delete(madrasaId);
};

/**
 * Whether a madrasa's plan currently allows use of the product.
 * endDate is the LAST valid day, so access continues through the end of that
 * day (a madrasa that paid until the 14th must not be locked out at 00:00 on
 * the 14th). A null endDate means no expiry.
 */
export async function getSubscriptionState(madrasaId: number): Promise<SubscriptionState> {
  const now = Date.now();
  const hit = cache.get(madrasaId);
  if (hit && hit.expiresAt > now) return hit.state;

  const subscription = await prisma.madrasaSubscription.findFirst({
    where: { madrasaId, isActive: 1 },
    select: { endDate: true },
    orderBy: { endDate: "desc" },
  });

  let state: SubscriptionState;
  if (!subscription) state = "NONE";
  else if (subscription.endDate && now >= new Date(subscription.endDate).getTime() + DAY_MS) state = "EXPIRED";
  else state = "ACTIVE";

  cache.set(madrasaId, { state, endDate: subscription?.endDate ?? null, expiresAt: now + CACHE_TTL_MS });
  return state;
}

/** Message shown to the madrasa when its plan has lapsed (auto-suspension). */
export const subscriptionSuspendedMessage = (state: Exclude<SubscriptionState, "ACTIVE">) =>
  state === "NONE"
    ? t({
        bn: "এই প্রতিষ্ঠানের কোনো সক্রিয় সাবস্ক্রিপশন নেই, তাই এটি স্থগিত আছে। অনুগ্রহ করে যোগাযোগ করুন।",
        en: "This institution has no active subscription and is suspended. Please contact support.",
      })
    : t({
        bn: "সাবস্ক্রিপশনের মেয়াদ শেষ হওয়ায় এই প্রতিষ্ঠানটি স্থগিত করা হয়েছে। নবায়নের জন্য অনুগ্রহ করে যোগাযোগ করুন।",
        en: "This institution is suspended because its subscription has expired. Please contact support to renew.",
      });

export async function subscriptionSuspendedBody(madrasaId: number) {
  const state = await getSubscriptionState(madrasaId);
  const cachedEnd = cache.get(madrasaId)?.endDate;
  const endDate = cachedEnd ?? (state === "NONE" ? (await prisma.madrasaSubscription.findFirst({
    where: { madrasaId }, select: { endDate: true }, orderBy: { id: "desc" },
  }))?.endDate : null) ?? null;
  return {
    message: subscriptionSuspendedMessage(state === "ACTIVE" ? "NONE" : state),
    code: state === "ACTIVE" ? undefined : state === "NONE" ? "SUBSCRIPTION_NONE" : "SUBSCRIPTION_EXPIRED",
    endDate,
    daysSinceExpiry: endDate ? Math.max(0, Math.floor((Date.now() - endDate.getTime()) / DAY_MS)) : null,
    retentionWarningDays: DATA_RETENTION_WARNING_DAYS,
    retentionNotice: retentionNotice(),
  };
}
