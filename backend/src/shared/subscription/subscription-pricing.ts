/** Subscription software only. SMS/email packs are billed separately. */
export type PricingCycle = "FIRST" | "RENEWAL";
type Money = number | string | { toString(): string };
export interface PricingPlan {
  studentLimit: number;
  price: Money | null;
  renewalPrice?: Money | null;
  extraStudentPriceFirst?: Money | null;
  extraStudentPriceRenewal?: Money | null;
}

export const MAX_PLAN_STUDENTS = 2000;
export const REFUND_DAYS = 30;
// DECISION: extend from the previous end date within 60 days of expiry.
export const RENEWAL_GRACE_DAYS = 60;
// DECISION: no late fee by default; applies only on days 16 through 60.
export const LATE_RENEWAL_FEE = 0;
// DECISION: the money-back policy covers the first purchase only.
export const REFUND_APPLIES_TO_RENEWALS = false;
const DAY_MS = 86_400_000;

/** Match subscription-state: a DATE endDate is valid through its UTC day. */
export function daysRemainingInTerm(endDate: Date | null, now = new Date()): number | null {
  if (!endDate) return null;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((endDate.getTime() - today) / DAY_MS);
}

export function pickPlanForStudents<T extends PricingPlan>(
  plans: readonly T[],
  studentCount: number,
): T | "CUSTOM" {
  if (studentCount > MAX_PLAN_STUDENTS) return "CUSTOM";
  return (
    [...plans]
      .sort((a, b) => a.studentLimit - b.studentLimit)
      .find((plan) => plan.studentLimit >= studentCount) ?? "CUSTOM"
  );
}

export function priceForCycle(plan: PricingPlan, cycle: PricingCycle): number {
  // Old plans have no renewal price. Preserve their existing price until edited.
  return Number(cycle === "RENEWAL" ? (plan.renewalPrice ?? plan.price ?? 0) : (plan.price ?? 0));
}

function prorate(amount: number, remainingDays: number, durationDays: number): number {
  if (durationDays <= 0 || remainingDays <= 0 || amount <= 0) return 0;
  const charge = (amount * Math.min(remainingDays, durationDays)) / durationDays;
  // Decimal prices such as 1.10 must not add a taka through binary float noise.
  return Math.ceil(charge - Number.EPSILON * Math.max(1, Math.abs(charge)) * 2);
}

export function extraStudentRate(plan: PricingPlan, cycle: PricingCycle): number {
  const configured =
    cycle === "FIRST" ? plan.extraStudentPriceFirst : plan.extraStudentPriceRenewal;
  if (configured != null) return Number(configured);
  const rates =
    plan.studentLimit <= 200
      ? [50, 20]
      : plan.studentLimit <= 700
        ? [35, 14]
        : plan.studentLimit <= MAX_PLAN_STUDENTS
          ? [25, 10]
          : [20, 8];
  return rates[cycle === "FIRST" ? 0 : 1];
}

interface Term {
  cycle: PricingCycle;
  remainingDays: number;
  durationDays: number;
}
export function extraStudentCharge(
  input: Term & { plan: PricingPlan; studentCount: number },
): number {
  const extra = Math.max(0, input.studentCount - input.plan.studentLimit);
  return prorate(
    extra * extraStudentRate(input.plan, input.cycle),
    input.remainingDays,
    input.durationDays,
  );
}

export function upgradeCharge(
  input: Term & { fromPlan: PricingPlan; toPlan: PricingPlan },
): number {
  return prorate(
    Math.max(
      0,
      priceForCycle(input.toPlan, input.cycle) - priceForCycle(input.fromPlan, input.cycle),
    ),
    input.remainingDays,
    input.durationDays,
  );
}

export function recommendOverLimitAction<T extends PricingPlan>(
  input: Term & { plan: T; plans: readonly T[]; studentCount: number },
) {
  const overLimit = input.studentCount > input.plan.studentLimit;
  const next = pickPlanForStudents(
    input.plans.filter((p) => p.studentLimit > input.plan.studentLimit),
    input.studentCount,
  );
  const extraAmount = extraStudentCharge(input);
  const upgradeAmount =
    overLimit && next !== "CUSTOM"
      ? upgradeCharge({ ...input, fromPlan: input.plan, toPlan: next })
      : null;
  return {
    studentCount: input.studentCount,
    studentLimit: input.plan.studentLimit,
    overLimit,
    blocked: false as const,
    extraAmount,
    upgradeAmount,
    upgradePlan: overLimit && next !== "CUSTOM" ? next : null,
    recommendedAction: !overLimit
      ? ("NONE" as const)
      : upgradeAmount !== null && upgradeAmount < extraAmount
        ? ("UPGRADE" as const)
        : ("EXTRA_STUDENTS" as const),
  };
}

export function isRefundEligible({
  startDate,
  now,
  cycle,
}: {
  startDate: Date;
  now: Date;
  cycle: PricingCycle;
}): boolean {
  const elapsed = now.getTime() - startDate.getTime();
  return (
    (cycle === "FIRST" || REFUND_APPLIES_TO_RENEWALS) &&
    elapsed >= 0 &&
    elapsed <= REFUND_DAYS * DAY_MS
  );
}

export function renewalTerms({ endDate, now }: { endDate: Date; now: Date }) {
  const daysLate = Math.ceil((now.getTime() - endDate.getTime()) / DAY_MS);
  return {
    extendsFrom: new Date(daysLate <= RENEWAL_GRACE_DAYS ? endDate : now),
    lateFee: daysLate >= 16 && daysLate <= RENEWAL_GRACE_DAYS ? LATE_RENEWAL_FEE : 0,
  };
}
