import { PublicPlansRepository, publicPlanSelect } from "./public-plans.repository";
import {
  CUSTOM_DOMAIN_PRICES,
  SUBSCRIPTION_INCLUDES,
  SUBSCRIPTION_EXCLUDES,
} from "../../shared/subscription/subscription.constants";
import { MAX_PLAN_STUDENTS, REFUND_DAYS } from "../../shared/subscription/subscription-pricing";

export class PublicPlansService {
  private cache?: { expires: number; plans: Record<string, unknown>[] };
  constructor(private readonly repository = new PublicPlansRepository()) {}
  cacheAgeSeconds() {
    return this.cache ? Math.max(0, Math.ceil((Date.now() - (this.cache.expires - 60_000)) / 1000)) : 0;
  }
  async list() {
    if (!this.cache || this.cache.expires <= Date.now()) {
      const rows = await this.repository.findVisible();
      const money = new Set([
        "price",
        "renewalPrice",
        "extraStudentPriceFirst",
        "extraStudentPriceRenewal",
      ]);
      const plans = rows.map((row) =>
        Object.fromEntries(
          Object.keys(publicPlanSelect).map((key) => {
            const value = row[key as keyof typeof row];
            return [key, money.has(key) && value != null ? Number(value) : value];
          }),
        ),
      );
      this.cache = { expires: Date.now() + 60_000, plans };
    }
    return {
      plans: this.cache.plans,
      refundDays: REFUND_DAYS,
      customDomain: CUSTOM_DOMAIN_PRICES,
      maxPlanStudents: MAX_PLAN_STUDENTS,
      includes: SUBSCRIPTION_INCLUDES,
      excludes: SUBSCRIPTION_EXCLUDES,
    };
  }
}
export const publicPlansService = new PublicPlansService();
