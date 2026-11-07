import api from "./adminApi";
import type { PlanCardData } from "@madrasha/shared-ui/src/components/plans/PlanCard";

export type PlanDisplayFields = {
  nameBn: string | null;
  tagline: string | null;
  taglineBn: string | null;
  renewalPrice: number | null;
  extraStudentPriceFirst: number | null;
  extraStudentPriceRenewal: number | null;
  sortOrder: number;
  accentColor: string | null;
  showOnLanding: number;
  isFeatured: number;
};
export type AdminPlan = PlanCardData &
  Partial<PlanDisplayFields> & {
    id: number;
    userLimit?: number | null;
    durationDays: number;
    isActive: number | boolean;
    regBlocks?: { divisionId: number; blockSize: number }[];
  };
export type PlanDefaults = Omit<AdminPlan, "id"> & { userLimit: null };
export async function getPlanDefaults(
  id: number,
): Promise<PlanDefaults | null> {
  return (await api.get(`/super/plans/${id}/defaults`)).data.data;
}
export async function updatePlanDisplay(
  id: number,
  patch: Partial<PlanDisplayFields>,
): Promise<{ warnings?: string[] }> {
  return (await api.put(`/super/plans/${id}`, patch)).data;
}

export type SubscriptionSnapshot = {
  subscription_id: number | null;
  plan_name: string | null;
  plan_name_bn: string | null;
  cycle: "FIRST" | "RENEWAL" | null;
  start_date: string | null;
  end_date: string | null;
  price_paid: number | null;
  price: number | null;
  renewal_price: number | null;
  next_renewal_price: number | null;
  plan_status: string;
  student_limit: number;
  usage: { students: number; users: number };
  days_remaining: number | null;
  days_since_expiry: number | null;
  retention_warning_days: number;
  retention_notice: string;
  over_limit: {
    extra_students: number;
    extra_charge: number;
    upgrade_to: { plan_name: string; charge: number } | null;
    recommended: "EXTRA" | "UPGRADE";
  } | null;
  refund: { eligible: boolean; until: string | null; amount: number };
  payments: {
    amount: number | null;
    method: string | null;
    status: string | null;
    date: string;
  }[];
  custom_domain: {
    domain: string;
    end_date: string;
    is_active: boolean;
  } | null;
  custom_domain_prices: { firstYear: number; renewal: number };
};
export async function getSubscription(
  id: number,
): Promise<SubscriptionSnapshot> {
  return (await api.get(`/super/madrasas/${id}`)).data.data.subscription;
}
export async function cancelSubscription(id: number, subscriptionId: number) {
  return (
    await api.post(
      `/super/madrasas/${id}/subscriptions/${subscriptionId}/cancel-refund`,
    )
  ).data;
}
export type ExpiredSubscription = {
  id: number;
  name: string;
  endDate: string;
  daysSinceExpiry: number;
  studentCount: number;
};
export async function getExpiredSubscriptions(): Promise<
  ExpiredSubscription[]
> {
  return (await api.get("/super/madrasas/expired")).data.data;
}
export type DomainSubscription = {
  id: number;
  domain: string;
  amountPaid: number;
  startDate: string;
  endDate: string;
  isActive: number;
  registeredInNameOf: "institution" | "platform";
  expired: boolean;
};
export type DomainDraft = {
  domain: string;
  amountPaid?: number;
  startDate: string;
  endDate: string;
  isActive: 0 | 1;
  registeredInNameOf: "institution" | "platform";
};
export async function getDomainSubscriptions(
  id: number,
): Promise<DomainSubscription[]> {
  return (await api.get(`/super/madrasas/${id}/domain-subscriptions`)).data
    .data;
}
export async function saveDomainSubscription(
  id: number,
  draft: DomainDraft,
  domainId?: number,
) {
  return domainId
    ? (
        await api.put(
          `/super/madrasas/${id}/domain-subscriptions/${domainId}`,
          draft,
        )
      ).data
    : (await api.post(`/super/madrasas/${id}/domain-subscriptions`, draft))
        .data;
}
export async function removeDomainSubscription(id: number, domainId: number) {
  return (
    await api.delete(`/super/madrasas/${id}/domain-subscriptions/${domainId}`)
  ).data;
}
