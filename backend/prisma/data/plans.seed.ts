import { PLAN_SEEDS } from "../../src/shared/subscription/plan-defaults";
export { PLAN_SEEDS } from "../../src/shared/subscription/plan-defaults";

/** Structural interface keeps this helper usable with Prisma and a test store. */
export async function seedPlans(store: {
  upsert(args: {
    where: { name: string };
    create: (typeof PLAN_SEEDS)[number];
    update: Record<string, never>;
  }): Promise<{ id: number }>;
}): Promise<number[]> {
  const ids: number[] = [];
  for (const plan of PLAN_SEEDS) {
    const row = await store.upsert({ where: { name: plan.name }, create: plan, update: {} });
    ids.push(row.id);
  }
  return ids;
}
