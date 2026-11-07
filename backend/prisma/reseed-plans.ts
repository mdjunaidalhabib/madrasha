import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { strict as assert } from "node:assert";
import { PLAN_SEEDS } from "../src/shared/subscription/plan-defaults";

/** Deliberate catalogue reset, unlike the create-only regular seed.
 * npx ts-node prisma/reseed-plans.ts            # read-only preview
 * npx ts-node prisma/reseed-plans.ts --apply    # backup + atomic reset
 * Replaces all plan prices/metadata with defaults and assigns IDs 1..9.
 * Preserves subscriptions, dates, amounts, payments, tenant limits and modules.
 * Keep the backend stopped during execution; restart to clear cached plan IDs.
 */
async function main() {
  const args = process.argv.slice(2);
  if (
    args.some((arg) => !["--apply", "--dry-run"].includes(arg)) ||
    (args.includes("--apply") && args.includes("--dry-run"))
  ) {
    throw new Error("Use --dry-run (default) or --apply.");
  }
  const apply = args.includes("--apply");
  const prisma = new PrismaClient();
  try {
    await prisma.$transaction(
      async (tx) => {
        if (apply) {
          await tx.$executeRawUnsafe(
            "LOCK TABLE plans, madrasa_subscriptions, plan_division_reg_blocks, subscription_payments IN ACCESS EXCLUSIVE MODE",
          );
        }
        const [plans, subscriptions, blocks, payments] = await Promise.all([
          tx.plan.findMany({ orderBy: { id: "asc" } }),
          tx.madrasaSubscription.findMany({ orderBy: { id: "asc" } }),
          tx.planDivisionRegBlock.findMany({ orderBy: [{ planId: "asc" }, { divisionId: "asc" }] }),
          tx.subscriptionPayment.findMany({ orderBy: { id: "asc" } }),
        ]);
        // Negative IDs temporarily park old rows. Both known foreign keys cascade
        // ON UPDATE; verify before changing any IDs, rather than assuming schema.
        const references = await tx.$queryRaw<{ table_name: string; update_action: string }[]>`
        SELECT conrelid::regclass::text AS table_name, confupdtype::text AS update_action
        FROM pg_constraint WHERE contype = 'f' AND confrelid = 'plans'::regclass`;
        if (
          references.length !== 2 ||
          references.some(
            (r) =>
              !["madrasa_subscriptions", "plan_division_reg_blocks"].includes(r.table_name) ||
              r.update_action !== "c",
          )
        ) {
          throw new Error("Unexpected plan foreign keys: aborting before writes.");
        }
        if (
          plans.some(
            (p) =>
              p.id <= 0 ||
              p.name.startsWith("__reseed_old_") ||
              p.studentLimit < 0 ||
              p.studentLimit > 2000,
          )
        ) {
          throw new Error("Unsupported plan ID or Custom limit: manual mapping required.");
        }
        const mapping = new Map<number, number>();
        for (const old of plans) {
          const seed = [...PLAN_SEEDS].sort(
            (a, b) =>
              Math.abs(a.studentLimit - old.studentLimit) -
                Math.abs(b.studentLimit - old.studentLimit) || b.studentLimit - a.studentLimit,
          )[0];
          const newId = PLAN_SEEDS.indexOf(seed) + 1;
          mapping.set(old.id, newId);
          console.log(
            JSON.stringify({ oldId: old.id, oldName: old.name, newId, newName: seed.name }),
          );
        }
        const newBlocks: { planId: number; divisionId: number; blockSize: number }[] = [];
        for (const [index, seed] of PLAN_SEEDS.entries()) {
          // Preserve the tier's configured registration blocks where available;
          // otherwise copy the nearest existing tier's preset, not tenant data.
          const source = plans
            .filter((p) => blocks.some((b) => b.planId === p.id))
            .sort(
              (a, b) =>
                Math.abs(a.studentLimit - seed.studentLimit) -
                  Math.abs(b.studentLimit - seed.studentLimit) ||
                Number(b.name === seed.name) - Number(a.name === seed.name) ||
                b.studentLimit - a.studentLimit,
            )[0];
          for (const block of blocks.filter((b) => b.planId === source?.id)) {
            newBlocks.push({
              planId: index + 1,
              divisionId: block.divisionId,
              blockSize: block.blockSize,
            });
          }
        }
        console.log(
          JSON.stringify({
            mode: apply ? "APPLY" : "DRY RUN",
            replaceWith: PLAN_SEEDS.map((p, i) => ({ id: i + 1, ...p })),
            subscriptionsPreserved: subscriptions.length,
            paymentsPreserved: payments.length,
            registrationBlocks: newBlocks,
          }),
        );
        if (!apply) return;

        const backupDir = resolve(__dirname, "../../.cache");
        mkdirSync(backupDir, { recursive: true });
        const backupPath = resolve(backupDir, `plan-reseed-backup-${Date.now()}.json`);
        writeFileSync(
          backupPath,
          JSON.stringify(
            {
              createdAt: new Date(),
              plans,
              subscriptions,
              blocks,
              payments,
              mapping: [...mapping],
            },
            null,
            2,
          ),
          { flag: "wx", mode: 0o600 },
        );
        console.log(`Backup: ${backupPath}`);

        await tx.$executeRawUnsafe("UPDATE plans SET id = -id, name = '__reseed_old_' || id::text");
        for (const [index, seed] of PLAN_SEEDS.entries()) {
          await tx.plan.create({ data: { id: index + 1, ...seed } });
        }
        for (const [oldId, newId] of mapping) {
          // Raw SQL changes only the FK; historical updatedAt also stays intact.
          await tx.$executeRaw`UPDATE madrasa_subscriptions SET plan_id = ${newId} WHERE plan_id = ${-oldId}`;
        }
        assert.equal(await tx.madrasaSubscription.count({ where: { planId: { lt: 0 } } }), 0);
        if (newBlocks.length) await tx.planDivisionRegBlock.createMany({ data: newBlocks });
        await tx.plan.deleteMany({ where: { id: { lt: 0 } } });

        const after = await tx.madrasaSubscription.findMany({ orderBy: { id: "asc" } });
        assert.deepEqual(
          JSON.parse(JSON.stringify(after)),
          JSON.parse(
            JSON.stringify(subscriptions.map((s) => ({ ...s, planId: mapping.get(s.planId)! }))),
          ),
        );
        assert.deepEqual(
          JSON.parse(
            JSON.stringify(await tx.subscriptionPayment.findMany({ orderBy: { id: "asc" } })),
          ),
          JSON.parse(JSON.stringify(payments)),
        );
        assert.equal(await tx.plan.count(), PLAN_SEEDS.length);
        // ALTER SEQUENCE is transactional; unlike setval it rolls back on failure.
        await tx.$executeRawUnsafe(
          `DO $$ BEGIN EXECUTE format('ALTER SEQUENCE %s RESTART WITH 10', pg_get_serial_sequence('plans', 'id')); END $$`,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000 },
    );
    console.log(
      apply
        ? "Committed: 9 default plans, IDs 1..9; subscriptions and payments verified unchanged except plan references."
        : "Dry run: no writes.",
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
