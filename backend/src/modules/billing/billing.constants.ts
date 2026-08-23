import { BillingChannel } from "./billing.types";

export const CHANNEL_LABEL_BN: Record<BillingChannel, string> = {
  SMS: "SMS",
  EMAIL: "ইমেইল",
};

/** PHASE 7/8 exact wording - kept centralized so both the pre-check and the
 * atomic-deduct failure path return identical user-facing messages. */
export const creditMessages = (channel: BillingChannel) => {
  const label = CHANNEL_LABEL_BN[channel];
  return {
    noSubscription: `আপনার ${label} প্যাকেজ সক্রিয় নেই। অনুগ্রহ করে একটি ${label} প্যাকেজ ক্রয় করুন।`,
    expired: `আপনার ${label} প্যাকেজের মেয়াদ শেষ হয়ে গেছে। অনুগ্রহ করে renew করুন।`,
    exhausted: `আপনার ${label} ক্রেডিট শেষ হয়ে গেছে। অনুগ্রহ করে ব্যালেন্স রিচার্জ করুন।`,
    insufficient: `আপনার ${label} ক্রেডিট অপর্যাপ্ত। অনুগ্রহ করে ব্যালেন্স রিচার্জ করুন।`,
  };
};

export const DEFAULT_LOW_CREDIT_THRESHOLD = 100;
export const DEFAULT_SELLING_PRICE = 0.5;
export const DEFAULT_PROVIDER_COST = 0;

/** Manual credit grants with no prior purchase need *some* validity window
 * so the subscription row is a well-formed "active" record - Super Admin
 * can still recharge/extend it normally afterwards. */
export const MANUAL_GRANT_DEFAULT_VALIDITY_DAYS = 365;
