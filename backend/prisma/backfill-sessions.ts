import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/** One-off backfill — converts every distinct legacy `academicYear` string on
 * Student/FeeStructure into a real Session row (Jan 1 - Dec 31 of that year,
 * since no other date info exists for old records), then points the
 * matching rows' `sessionId` at it. `academicYear` itself is left untouched.
 * Idempotent: re-running skips any (madrasa, year) that already has a
 * Session, and skips any row that already has a sessionId.
 *
 * Dry run (default):  npx ts-node prisma/backfill-sessions.ts
 * Apply for real:      npx ts-node prisma/backfill-sessions.ts --apply */

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");

function sessionDatesForYear(year: string): { startDate: Date; endDate: Date } | null {
  const yearNum = Number(year);
  if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > 2200) return null;
  return {
    startDate: new Date(Date.UTC(yearNum, 0, 1)),
    endDate: new Date(Date.UTC(yearNum, 11, 31)),
  };
}

async function main() {
  const currentYear = String(new Date().getFullYear());

  const madrasas = await prisma.madrasa.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
  });

  let totalSessionsToCreate = 0;
  let totalStudentsToLink = 0;
  let totalFeeStructuresToLink = 0;
  let skippedInvalidYears = 0;

  for (const madrasa of madrasas) {
    const [studentYears, feeYears] = await Promise.all([
      prisma.student.findMany({
        where: { madrasaId: madrasa.id, sessionId: null },
        select: { academicYear: true },
        distinct: ["academicYear"],
      }),
      prisma.feeStructure.findMany({
        where: { madrasaId: madrasa.id, sessionId: null },
        select: { academicYear: true },
        distinct: ["academicYear"],
      }),
    ]);

    const distinctYears = new Set<string>([
      ...studentYears.map((s) => s.academicYear),
      ...feeYears.map((f) => f.academicYear),
    ]);

    if (distinctYears.size === 0) continue;

    let madrasaSessionsCreated = 0;
    let madrasaStudentsLinked = 0;
    let madrasaFeeStructuresLinked = 0;

    for (const year of distinctYears) {
      const dates = sessionDatesForYear(year);
      if (!dates) {
        skippedInvalidYears++;
        console.log(`   ! ${madrasa.name}: skipping unparseable academicYear "${year}"`);
        continue;
      }

      let session = await prisma.session.findUnique({
        where: { madrasaId_name: { madrasaId: madrasa.id, name: year } },
        select: { id: true },
      });

      if (!session) {
        totalSessionsToCreate++;
        madrasaSessionsCreated++;
        if (APPLY) {
          session = await prisma.session.create({
            data: {
              madrasaId: madrasa.id,
              name: year,
              startDate: dates.startDate,
              endDate: dates.endDate,
              isCurrent: year === currentYear,
              isActive: true,
            },
            select: { id: true },
          });
        }
      }

      const studentCount = await prisma.student.count({
        where: { madrasaId: madrasa.id, academicYear: year, sessionId: null },
      });
      const feeStructureCount = await prisma.feeStructure.count({
        where: { madrasaId: madrasa.id, academicYear: year, sessionId: null },
      });
      totalStudentsToLink += studentCount;
      totalFeeStructuresToLink += feeStructureCount;
      madrasaStudentsLinked += studentCount;
      madrasaFeeStructuresLinked += feeStructureCount;

      if (APPLY && session) {
        await prisma.student.updateMany({
          where: { madrasaId: madrasa.id, academicYear: year, sessionId: null },
          data: { sessionId: session.id },
        });
        await prisma.feeStructure.updateMany({
          where: { madrasaId: madrasa.id, academicYear: year, sessionId: null },
          data: { sessionId: session.id },
        });
      }
    }

    console.log(
      `   - ${madrasa.name}: ${madrasaSessionsCreated} session(s), ${madrasaStudentsLinked} student(s), ${madrasaFeeStructuresLinked} fee structure(s)`,
    );
  }

  console.log(`\nMadrasas scanned: ${madrasas.length}`);
  console.log(`Sessions to create: ${totalSessionsToCreate}`);
  console.log(`Students to link: ${totalStudentsToLink}`);
  console.log(`Fee structures to link: ${totalFeeStructuresToLink}`);
  if (skippedInvalidYears > 0) {
    console.log(`Skipped (unparseable academicYear): ${skippedInvalidYears}`);
  }

  if (!APPLY) {
    console.log("\nDry run only — no rows written. Re-run with --apply to actually insert/link these rows.");
    return;
  }

  console.log("\n✅ Backfill applied.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
