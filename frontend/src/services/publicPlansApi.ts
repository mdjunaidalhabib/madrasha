import { API_BASE_URL } from "@madrasha/shared-ui/src/services/apiConfig";
import type { PlanCardData } from "@madrasha/shared-ui/src/components/plans/PlanCard";

export interface PublicPlan extends PlanCardData {
  id: number;
  price: number | null;
  renewalPrice: number | null;
  durationDays: number | null;
}
export type PricingLabel = { bn: string; en: string };
export interface PublicPricing {
  plans: PublicPlan[];
  refundDays: number;
  maxPlanStudents: number;
  customDomain: { firstYear: number; renewal: number };
  includes: PricingLabel[];
  excludes: PricingLabel[];
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid pricing response");
  return value as Record<string, unknown>;
}
function number(value: unknown): number {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    value === "" ||
    !Number.isFinite(Number(value)) ||
    Number(value) < 0
  )
    throw new Error("Invalid pricing number");
  return Number(value);
}
function integer(value: unknown): number {
  const result = number(value);
  if (!Number.isSafeInteger(result)) throw new Error("Invalid pricing limit");
  return result;
}
function positiveInteger(value: unknown): number {
  const result = integer(value);
  if (result < 1) throw new Error("Invalid pricing limit");
  return result;
}
function labels(value: unknown): PricingLabel[] {
  if (!Array.isArray(value) || !value.length) throw new Error("Missing pricing labels");
  return value.map((entry) => {
    const item = record(entry);
    if (
      typeof item.bn !== "string" ||
      typeof item.en !== "string" ||
      !item.bn.trim() ||
      !item.en.trim()
    )
      throw new Error("Invalid pricing label");
    return { bn: item.bn, en: item.en };
  });
}
function optionalText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** Reject malformed data instead of showing guessed prices or fake plans. */
export function parsePublicPricing(response: unknown): PublicPricing {
  const data = record(record(response).data);
  const domain = record(data.customDomain);
  if (!Array.isArray(data.plans)) throw new Error("Missing plans");
  const plans = data.plans.map((entry, index): PublicPlan => {
    const plan = record(entry);
    if (typeof plan.name !== "string" || !plan.name.trim()) throw new Error("Missing plan name");
    return {
      id: positiveInteger(plan.id),
      name: plan.name,
      nameBn: optionalText(plan.nameBn),
      tagline: optionalText(plan.tagline),
      taglineBn: optionalText(plan.taglineBn),
      studentLimit: integer(plan.studentLimit),
      price: plan.price == null ? null : number(plan.price),
      renewalPrice: plan.renewalPrice == null ? null : number(plan.renewalPrice),
      durationDays: plan.durationDays == null ? null : positiveInteger(plan.durationDays),
      accentColor: optionalText(plan.accentColor),
      isFeatured: plan.isFeatured === 1 || plan.isFeatured === true,
      // The public catalogue is already ordered by sortOrder. Use its position
      // for the shared card's motif/palette when sortOrder is not projected.
      sortOrder: plan.sortOrder == null ? index + 1 : number(plan.sortOrder),
    };
  });
  if (new Set(plans.map((plan) => plan.id)).size !== plans.length)
    throw new Error("Duplicate plan IDs");
  return {
    plans,
    refundDays: positiveInteger(data.refundDays),
    maxPlanStudents: positiveInteger(data.maxPlanStudents),
    customDomain: { firstYear: number(domain.firstYear), renewal: number(domain.renewal) },
    includes: labels(data.includes),
    excludes: labels(data.excludes),
  };
}

export async function getPublicPricing(signal: AbortSignal): Promise<PublicPricing> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();
  const timer = window.setTimeout(cancel, 15_000);
  try {
    const response = await fetch(`${API_BASE_URL}/public/plans`, {
      signal: controller.signal,
      credentials: "omit",
      cache: "no-cache",
    });
    if (!response.ok) throw new Error("Pricing request failed");
    return parsePublicPricing(await response.json());
  } finally {
    window.clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
  }
}
