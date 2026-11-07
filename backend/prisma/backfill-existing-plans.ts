import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";
import { PLAN_SEEDS } from "../src/shared/subscription/plan-defaults";
import { MAX_PLAN_STUDENTS } from "../src/shared/subscription/subscription-pricing";

/** One-off migration after the Phase 1 schema migration; seed.ts is not required.
 *
 * Preview (default): npx ts-node prisma/backfill-existing-plans.ts --dry-run
 * Apply:             npx ts-node prisma/backfill-existing-plans.ts --apply
 * Owner-confirmed module opt-in: append --enable-all-modules to either command.
 * Run with the backend stopped, then restart it to discard process-local caches.
 *
 * Existing canonical plans keep their edited prices and IDs. Legacy plans are
 * retained but retired from sale; subscriptions are re-pointed, never replaced.
 * Standard(300) -> Plus(300), freeing the unique Standard name for Standard(200).
 * Every write is printed with its row key and before/after values. New IDs are
 * database-generated, so previews refer to new plans by their unique name.
 * Current dates, paid amounts, cycles, limits and subscription activity are kept.
 * No payments, refunds, subscription creation/deletion, or permission writes.
 * Re-running against unchanged data performs no further writes.
 */

type Options = { apply: boolean; enableAllModules: boolean };
type PlanRef = number | string;

export async function backfillExistingPlans(
  db: Prisma.TransactionClient,
  options: Options,
  log: (message: string) => void = console.log,
) {
  const [plans, subscriptions, madrasas] = await Promise.all([
    db.plan.findMany({ orderBy: { id: "asc" } }),
    db.madrasaSubscription.findMany({ orderBy: { id: "asc" } }),
    db.madrasa.findMany({
      select: { id: true, name: true, deletedAt: true, studentLimit: true, userLimit: true },
      orderBy: { id: "asc" },
    }),
  ]);
  const actions: { preview: object; execute: () => Promise<unknown> }[] = [];
  const targets = new Map<string, PlanRef>();
  const resolvedIds = new Map<string, number>();
  const mappings = new Map<number, (typeof PLAN_SEEDS)[number]>();
  const canonical = new Set<number>();
  const now = new Date();
  const emit = (value: object) => log(JSON.stringify(value));

  for (const seed of PLAN_SEEDS) {
    const existing = plans.find(
      (p) => p.name === seed.name && p.studentLimit === seed.studentLimit,
    );
    if (existing) {
      // Do not silently restore a plan the owner deliberately disabled/deleted.
      if (existing.isActive !== 1 || existing.deletedAt) {
        throw new Error(
          `Canonical plan ${existing.id} (${seed.name}) is inactive/deleted; review it before migrating.`,
        );
      }
      canonical.add(existing.id);
      targets.set(seed.name, existing.id);
    } else targets.set(seed.name, `new:${seed.name}`);
  }

  for (const source of plans) {
    if (source.studentLimit < 0 || source.studentLimit > MAX_PLAN_STUDENTS) {
      emit({
        keepPlan: source.id,
        name: source.name,
        reason: "Custom/unsupported limit: manual owner review; no automatic mapping.",
      });
      if (PLAN_SEEDS.some((seed) => seed.name === source.name)) {
        throw new Error(
          `Unmapped plan ${source.id} occupies a canonical name; resolve the name manually first.`,
        );
      }
      continue;
    }
    // Nearest catalogue limit; equally near limits choose the larger capacity.
    const nearest = [...PLAN_SEEDS].sort(
      (a, b) =>
        Math.abs(a.studentLimit - source.studentLimit) -
          Math.abs(b.studentLimit - source.studentLimit) || b.studentLimit - a.studentLimit,
    )[0];
    mappings.set(source.id, nearest);
    emit({
      mapPlan: source.id,
      name: source.name,
      studentLimit: source.studentLimit,
      to: targets.get(nearest.name),
      targetName: nearest.name,
      targetLimit: nearest.studentLimit,
    });
    if (canonical.has(source.id)) continue;

    const conflicts = PLAN_SEEDS.some((seed) => seed.name === source.name);
    const name = conflicts ? `Legacy ${source.name.slice(0, 70)} #${source.id}` : source.name;
    if (name !== source.name && plans.some((p) => p.id !== source.id && p.name === name)) {
      throw new Error(`Legacy name ${name} already exists; resolve it manually first.`);
    }
    if (name === source.name && source.isActive === 0 && source.showOnLanding === 0) continue;
    const data = { name, isActive: 0, showOnLanding: 0, updatedAt: now };
    actions.push({
      preview: {
        table: "plans",
        id: source.id,
        before: {
          name: source.name,
          isActive: source.isActive,
          showOnLanding: source.showOnLanding,
          updatedAt: source.updatedAt,
        },
        after: data,
      },
      execute: () => db.plan.update({ where: { id: source.id }, data }),
    });
  }

  for (const seed of PLAN_SEEDS) {
    const ref = targets.get(seed.name)!;
    if (typeof ref === "number") continue;
    const data = { ...seed, createdAt: now, updatedAt: now };
    actions.push({
      preview: { table: "plans", create: ref, data },
      execute: async () => {
        const created = await db.plan.create({ data });
        resolvedIds.set(ref, created.id);
        emit({ resolvedPlan: ref, id: created.id });
      },
    });
  }

  const latest = new Map<number, number>();
  for (const subscription of subscriptions) {
    latest.set(subscription.madrasaId, subscription.id);
    emit({
      keepSubscription: subscription.id,
      madrasaId: subscription.madrasaId,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      cycle: subscription.cycle,
      pricePaid: subscription.pricePaid,
      studentLimitAtStart: subscription.studentLimitAtStart,
      isActive: subscription.isActive,
    });
    const target = mappings.get(subscription.planId);
    if (!target) continue;
    const ref = targets.get(target.name)!;
    if (ref === subscription.planId) continue;
    actions.push({
      preview: {
        table: "madrasa_subscriptions",
        id: subscription.id,
        madrasaId: subscription.madrasaId,
        before: { planId: subscription.planId, updatedAt: subscription.updatedAt },
        after: { planId: ref, updatedAt: now },
      },
      execute: () => {
        const planId = typeof ref === "number" ? ref : resolvedIds.get(ref);
        if (planId === undefined) throw new Error(`Unresolved target ${ref}`);
        return db.madrasaSubscription.update({
          where: { id: subscription.id },
          data: { planId, updatedAt: now },
        });
      },
    });
  }

  for (const madrasa of madrasas) {
    // DECISION: existing madrasas enter RENEWAL at their next renewal. The
    // purchase service already uses any prior subscription (including expired
    // or cancelled history) to select RENEWAL. Do not rewrite the current cycle,
    // which would change current-term extra charges and refund eligibility.
    emit({
      keepMadrasa: madrasa.id,
      name: madrasa.name,
      studentLimit: madrasa.studentLimit,
      userLimit: madrasa.userLimit,
      latestSubscription: latest.get(madrasa.id) ?? null,
      nextCycle: latest.has(madrasa.id) ? "RENEWAL" : null,
      note: latest.has(madrasa.id)
        ? "Existing subscription history already selects RENEWAL on next purchase."
        : "No subscription history: manual owner review; no synthetic subscription or invented dates.",
    });
  }

  // DECISION: preserve module sets unless the owner deliberately opts in with
  // --enable-all-modules. This never grants roles/permissions or enables a
  // globally disabled module, and does not touch soft-deleted madrasas.
  if (options.enableAllModules) {
    const [modules, assignments] = await Promise.all([
      db.moduleDef.findMany({ where: { isActive: 1 }, orderBy: { id: "asc" } }),
      db.madrasaModule.findMany({ orderBy: { id: "asc" } }),
    ]);
    const byPair = new Map(assignments.map((row) => [`${row.madrasaId}:${row.moduleId}`, row]));
    for (const madrasa of madrasas.filter((row) => !row.deletedAt)) {
      for (const module of modules) {
        const existing = byPair.get(`${madrasa.id}:${module.id}`);
        if (existing?.isActive === 1) continue;
        if (existing) {
          const data = { isActive: 1, updatedAt: now };
          actions.push({
            preview: {
              table: "madrasa_modules",
              id: existing.id,
              madrasaId: madrasa.id,
              moduleId: module.id,
              moduleKey: module.keyName,
              before: { isActive: existing.isActive, updatedAt: existing.updatedAt },
              after: data,
            },
            execute: () => db.madrasaModule.update({ where: { id: existing.id }, data }),
          });
        } else {
          const data = {
            madrasaId: madrasa.id,
            moduleId: module.id,
            isActive: 1,
            createdAt: now,
            updatedAt: now,
          };
          actions.push({
            preview: { table: "madrasa_modules", moduleKey: module.keyName, create: data },
            execute: () => db.madrasaModule.create({ data }),
          });
        }
      }
    }
  } else log("KEEP all current module assignments (no --enable-all-modules confirmation).");

  for (const action of actions) emit(action.preview);
  log(
    `${options.apply ? "APPLY" : "DRY RUN"}: ${actions.length} write(s) planned. No subscription dates, billing amounts, cycles, or tenant limits change.`,
  );
  if (options.apply) for (const action of actions) await action.execute();
  else
    log(
      "Dry run only: no rows written. Use --apply to execute; new:<name> denotes a database-generated plan ID.",
    );
  return actions.length;
}

async function main() {
  const args = process.argv.slice(2);
  if (
    args.some((arg) => !["--apply", "--dry-run", "--enable-all-modules"].includes(arg)) ||
    (args.includes("--apply") && args.includes("--dry-run"))
  ) {
    throw new Error(
      "Usage: npx ts-node prisma/backfill-existing-plans.ts [--dry-run | --apply] [--enable-all-modules]",
    );
  }
  const options = {
    apply: args.includes("--apply"),
    enableAllModules: args.includes("--enable-all-modules"),
  };
  const prisma = new PrismaClient();
  try {
    if (options.apply) {
      await prisma.$transaction((tx) => backfillExistingPlans(tx, options), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 120_000,
      });
      console.log("Migration committed.");
    } else await backfillExistingPlans(prisma, options);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
