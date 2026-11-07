import type { PublicPlan } from "../../services/publicPlansApi";

export function matchingPlan(plans: PublicPlan[], count: number, max: number): PublicPlan | null {
  if (count > max) return null;
  return (
    [...plans]
      .sort((a, b) => a.studentLimit - b.studentLimit)
      .find((plan) => plan.studentLimit >= count) ?? null
  );
}

export function pricingQuickChoices(plans: PublicPlan[]): number[] {
  const limits = [...new Set(plans.map((plan) => plan.studentLimit))].sort((a, b) => a - b);
  // Representative catalogue positions; every displayed value comes from the API.
  const preferred = [0, 1, 3, 4, 6]
    .map((index) => limits[index])
    .filter((value) => value !== undefined);
  return [...new Set([...preferred, ...limits])].slice(0, 5).sort((a, b) => a - b);
}

export function pricingGroups(plans: PublicPlan[]): PublicPlan[][] {
  return Array.from({ length: Math.ceil(plans.length / 3) }, (_, index) =>
    plans.slice(index * 3, index * 3 + 3),
  );
}

/** Keep the featured card central within a compact group, preserving other cards' order. */
export function centerFeatured(plans: PublicPlan[]): PublicPlan[] {
  const featured = plans.find((plan) => plan.isFeatured);
  if (!featured || plans.length < 3) return plans;
  const others = plans.filter((plan) => plan.id !== featured.id);
  return [others[0], featured, ...others.slice(1)];
}
