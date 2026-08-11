import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/** One-off backfill — adds "পরীক্ষার ফি" (YEARLY) and "বোর্ডিং ফি" (MONTHLY)
 * fee structures to every class of every currently active madrasa, using
 * the same division-tiered amounts as the new default fee templates in
 * seed.ts. Safe to re-run: skips any (madrasa, class, fee name, academic
 * year) combination that already exists.
 *
 * Dry run (default):  npx ts-node prisma/backfill-exam-boarding-fee.ts
 * Apply for real:      npx ts-node prisma/backfill-exam-boarding-fee.ts --apply */

const prisma = new PrismaClient();

const feeTierByDivision: Record<string, { exam: number; boarding: number }> = {
  nurani: { exam: 150, boarding: 500 },
  nazera_hifz: { exam: 200, boarding: 600 },
  kitab: { exam: 300, boarding: 800 },
  takhassus: { exam: 400, boarding: 1000 },
};

const APPLY = process.argv.includes("--apply");

async function main() {
  const academicYear = String(new Date().getFullYear());

  const madrasas = await prisma.madrasa.findMany({
    where: { isActive: 1, deletedAt: null },
    select: { id: true, name: true },
  });

  const toCreate: {
    madrasaId: number;
    madrasaName: string;
    className: string;
    classId: number;
    name: string;
    amount: number;
    frequency: "YEARLY" | "MONTHLY";
  }[] = [];

  for (const madrasa of madrasas) {
    const madrasaClasses = await prisma.madrasaClass.findMany({
      where: { madrasaId: madrasa.id, isActive: 1, deletedAt: null },
      select: {
        classId: true,
        class: { select: { nameBn: true, division: { select: { keyName: true } } } },
      },
    });

    for (const mc of madrasaClasses) {
      const divisionKey = mc.class.division?.keyName;
      const tier = divisionKey ? feeTierByDivision[divisionKey] : undefined;
      if (!tier) continue;

      const specs: { name: string; amount: number; frequency: "YEARLY" | "MONTHLY" }[] = [
        { name: "পরীক্ষার ফি", amount: tier.exam, frequency: "YEARLY" },
        { name: "বোর্ডিং ফি", amount: tier.boarding, frequency: "MONTHLY" },
      ];

      for (const spec of specs) {
        const exists = await prisma.feeStructure.findFirst({
          where: { madrasaId: madrasa.id, classId: mc.classId, name: spec.name, academicYear },
          select: { id: true },
        });
        if (exists) continue;

        toCreate.push({
          madrasaId: madrasa.id,
          madrasaName: madrasa.name,
          classId: mc.classId,
          className: mc.class.nameBn ?? `#${mc.classId}`,
          name: spec.name,
          amount: spec.amount,
          frequency: spec.frequency,
        });
      }
    }
  }

  console.log(`Academic year: ${academicYear}`);
  console.log(`Active madrasas: ${madrasas.length}`);
  console.log(`Fee rows to create: ${toCreate.length}`);

  const byMadrasa = new Map<string, number>();
  for (const row of toCreate) byMadrasa.set(row.madrasaName, (byMadrasa.get(row.madrasaName) ?? 0) + 1);
  for (const [name, count] of byMadrasa.entries()) {
    console.log(`   - ${name}: ${count} rows`);
  }

  if (!toCreate.length) {
    console.log("Nothing to do.");
    return;
  }

  if (!APPLY) {
    console.log("\nDry run only — no rows written. Re-run with --apply to actually insert these rows.");
    return;
  }

  await prisma.feeStructure.createMany({
    data: toCreate.map((r) => ({
      madrasaId: r.madrasaId,
      classId: r.classId,
      name: r.name,
      amount: r.amount,
      frequency: r.frequency,
      academicYear,
    })),
  });
  console.log(`\n✅ Created ${toCreate.length} fee structure rows across ${byMadrasa.size} madrasas.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
