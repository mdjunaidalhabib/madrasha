import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/** One-off backfill for already-provisioned madrasas — applies the new "ফি
 * ব্যবস্থাপনা" (fee) module split on real DB rows instead of relying solely
 * on sidebar.service.ts's virtual-row fallback (which only patches the menu
 * display, not MadrasaModule-backed route access via ModuleGuard):
 *   - activates "fee" (MadrasaModule) for every madrasa that already has
 *     "students" active
 *
 * The "fee" ModuleDef/ModuleFeature rows themselves are already created by
 * seed.ts - this script only backfills per-madrasa activation, same as
 * backfill-teacher-staff-module.ts did for the teacher_staff split.
 *
 * Idempotent: safe to re-run.
 *
 * Dry run (default): npx ts-node prisma/backfill-fee-module.ts
 * Apply for real:     npx ts-node prisma/backfill-fee-module.ts --apply */

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");

async function main() {
  const feeModule = await prisma.moduleDef.findUnique({ where: { keyName: "fee" } });
  if (!feeModule) {
    console.log('"fee" module not found - run `npx prisma db seed` first.');
    return;
  }

  const studentsModule = await prisma.moduleDef.findUnique({ where: { keyName: "students" } });
  if (!studentsModule) {
    console.log('"students" module not found - nothing to backfill against.');
    return;
  }

  const activeStudents = await prisma.madrasaModule.findMany({
    where: { moduleId: studentsModule.id, isActive: 1 },
    select: { madrasaId: true },
  });
  console.log(`Madrasas with শিক্ষার্থী active: ${activeStudents.length}`);

  if (APPLY) {
    await prisma.madrasaModule.createMany({
      data: activeStudents.map((m) => ({
        madrasaId: m.madrasaId,
        moduleId: feeModule.id,
        isActive: 1,
      })),
      skipDuplicates: true,
    });
    console.log("\n✅ Backfill applied.");
  } else {
    console.log("\nDry run only - no rows written. Re-run with --apply to actually write these changes.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
