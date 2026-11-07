import axios from "axios";
import { API_BASE_URL } from "@madrasha/shared-ui/src/services/apiConfig";
import type { PlanCardData } from "@madrasha/shared-ui/src/components/plans/PlanCard";
import { cachedGet } from "./api";

export type PlanStatus = "trial" | "active" | "expired" | "suspended";

export type MyPlan = {
  subscription_id?: number | null;
  plan_name_bn?: string | null;
  cycle?: "FIRST" | "RENEWAL" | null;
  renewal_price?: number | null;
  price_paid?: number | null;
  next_renewal_price?: number | null;
  days_since_expiry?: number | null;
  retention_warning_days?: number;
  retention_notice?: string;
  renewal_contact?: { phone_display: string; phone_intl: string; email: string };
  refund?: { eligible: boolean; until: string | null; amount?: number };
  custom_domain?: { domain: string; end_date: string; is_active: boolean } | null;
  payments?: {
    amount: number | null;
    method: string | null;
    status: string | null;
    date: string;
  }[];
  includes?: { bn: string; en: string }[];
  excludes?: { bn: string; en: string }[];
  custom_domain_prices?: { firstYear: number; renewal: number };
  over_limit?: {
    extra_students: number;
    extra_charge: number;
    upgrade_to: { plan_name: string; charge: number } | null;
    recommended: "EXTRA" | "UPGRADE";
  } | null;
  accent_color?: string | null;
  sort_order?: number;
  plan_name: string | null;
  price: number | null;
  duration_days: number | null;
  start_date: string | null;
  end_date: string | null;
  days_remaining: number | null;
  plan_status: PlanStatus;
  has_active_subscription: boolean;
  student_limit: number;
  user_limit: number;
  usage: {
    students: number;
    users: number;
  };
};

export async function getMyPlan(
  options: { force?: boolean; signal?: AbortSignal } = {},
): Promise<MyPlan> {
  const res = await cachedGet<{ data: MyPlan }>(
    "/settings/plan",
    { silent: true, signal: options.signal },
    options.force ? 0 : undefined,
  );
  return res.data.data;
}

/** Display-only metadata. Tenant prices, limits and billing always come from getMyPlan. */
export async function getPlanAppearance(
  name: string,
  signal: AbortSignal,
): Promise<Partial<PlanCardData> | null> {
  const response = await axios.get(`${API_BASE_URL}/public/plans`, {
    signal,
    timeout: 10_000,
    withCredentials: false,
  });
  const plans = response.data?.data?.plans;
  if (!Array.isArray(plans)) return null;
  const index = plans.findIndex((plan) => plan.name === name);
  if (index < 0) return null;
  const plan = plans[index];
  return {
    accentColor: plan.accentColor,
    sortOrder: plan.sortOrder ?? index + 1,
    tagline: plan.tagline,
    taglineBn: plan.taglineBn,
  };
}

export function isPlanSuspended(plan: MyPlan): boolean {
  return (
    !plan.has_active_subscription ||
    plan.plan_status === "expired" ||
    plan.plan_status === "suspended" ||
    (plan.days_remaining !== null && plan.days_remaining < 0)
  );
}
