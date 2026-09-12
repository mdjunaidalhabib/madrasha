import "dotenv/config";
import { superAdminService as superadminService } from "../../src/modules/super-admin/superadmin.service";
import { prisma } from "../../src/shared/database/prisma";
import { writeFixtureState } from "./lib";

// Provisions two dedicated, clearly-labeled test madrasas for E2E
// verification, reusing the REAL superadmin provisioning service (same
// logic path a real super admin's "create madrasa" action uses) rather
// than hand-rolling fixture creation - this guarantees the catalog
// activation (division/class/book), default roles+permissions, and default
// users are set up exactly as production would. Idempotent-ish: if a
// madrasa with the target slug already exists from a prior run, it's
// reused instead of creating a duplicate.

const DIVISION_ID = 1; // Nurani
const CLASS_ID = 1; // Child (under Nurani)
const BOOK_IDS = [2, 3, 4]; // Bangla, English, Gonit (under Child)
const MODULE_IDS = [1, 3, 4, 6, 7]; // dashboard, reports, talimat, students, settings

const TEST_PASSWORD = "E2eTest#2026!";

async function findOrCreateMadrasa(slug: string, name: string) {
  const existing = await prisma.madrasa.findUnique({ where: { slug } });
  if (existing) {
    console.log(`[reuse] ${slug} -> madrasaId=${existing.id}`);
    return existing.id;
  }

  const created = await superadminService.createMadrasa({
    name,
    slug,
    student_limit: 500,
    user_limit: 20,
    divisions: [DIVISION_ID],
    classes: [CLASS_ID],
    books: BOOK_IDS,
    modules: MODULE_IDS,
    default_users: [
      { role: "MUHTAMIM", name: `${name} Muhtamim`, email: `muhtamim@${slug}.e2e-test`, password: TEST_PASSWORD },
      { role: "TALIMAT", name: `${name} Talimat`, email: `talimat@${slug}.e2e-test`, password: TEST_PASSWORD },
    ],
  } as any);

  console.log(`[created] ${slug} -> madrasaId=${created.madrasaId}`);
  return created.madrasaId;
}

async function main() {
  const madrasaAId = await findOrCreateMadrasa("e2e-test-madrasa-a", "E2E Test Madrasa A");
  const madrasaBId = await findOrCreateMadrasa("e2e-test-madrasa-b", "E2E Test Madrasa B");

  // Persist for later phases - don't let them hardcode these ids, which
  // drift every time the DB is reset/reseeded (see lib.ts's fixture-state
  // comment).
  writeFixtureState({ madrasaAId, madrasaBId });

  console.log(
    JSON.stringify(
      {
        madrasaA: { id: madrasaAId, slug: "e2e-test-madrasa-a" },
        madrasaB: { id: madrasaBId, slug: "e2e-test-madrasa-b" },
        password: TEST_PASSWORD,
        divisionId: DIVISION_ID,
        classId: CLASS_ID,
        bookIds: BOOK_IDS,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error("PHASE 0 FAILED:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
