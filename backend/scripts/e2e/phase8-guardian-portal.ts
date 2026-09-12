import "dotenv/config";
import { prisma } from "../../src/shared/database/prisma";
import { hashPassword } from "../../src/shared/utils/hash.util";
import { post, check, summary, readFixtureState } from "./lib";

const SLUG_A = "e2e-test-madrasa-a";
const GUARDIAN_PASSWORD = "GuardianE2E#2026!";

async function main() {
  console.log("=== Phase 8: Guardian portal ===");

  const state = readFixtureState() as { madrasaAId?: number; studentsA?: number[] };
  if (!state.madrasaAId || !state.studentsA?.length) {
    throw new Error("Missing madrasaAId/studentsA in fixture state - run phase0/phase2 first");
  }
  const madrasaAId = state.madrasaAId;
  const STUDENT_WITH_PUBLISHED_RESULT = state.studentsA[0]; // Exam A1's published/locked result covers this student
  const STUDENT_OTHER = state.studentsA[1]; // a different student, NOT this guardian's child

  // ---- Fixture: create a guardian directly linked to ONE student only ----
  const passwordHash = await hashPassword(GUARDIAN_PASSWORD);
  const guardian = await prisma.guardian.upsert({
    where: { madrasaId_phone: { madrasaId: madrasaAId, phone: "01700000001" } },
    update: { passwordHash, mustChangePassword: false },
    create: {
      madrasaId: madrasaAId,
      phone: "01700000001",
      name: "E2E Test Guardian",
      passwordHash,
      mustChangePassword: false,
    },
  });
  await prisma.guardianStudent.deleteMany({ where: { guardianId: guardian.id } });
  await prisma.guardianStudent.create({
    data: { guardianId: guardian.id, studentId: STUDENT_WITH_PUBLISHED_RESULT },
  });
  check("Guardian fixture created and linked to studentsA[0] only", true);

  // ---- Login as guardian (real HTTP, exercises guardianAuthMiddleware) ----
  const loginRes = await post("/guardian/login", { phone: "01700000001", password: GUARDIAN_PASSWORD }, { slug: SLUG_A });
  check("Guardian login succeeds", loginRes.status === 200 && !!loginRes.body?.token, {
    status: loginRes.status,
    body: loginRes.body,
  });
  const guardianToken = loginRes.body?.token;

  // ---- Own child's PUBLISHED result: must be visible ----
  const ownResult = await fetchAs(`/guardian/students/${STUDENT_WITH_PUBLISHED_RESULT}/results`, guardianToken);
  check("Guardian can see own child's published result", ownResult.status === 200, {
    status: ownResult.status,
    body: ownResult.body,
  });
  const rows: any[] = ownResult.body?.data ?? [];
  check("Own child's result list is non-empty (the published/locked Exam A1 result)", rows.length > 0, { rows });

  // ---- Another guardian's/unrelated student's result: must be BLOCKED ----
  const otherResult = await fetchAs(`/guardian/students/${STUDENT_OTHER}/results`, guardianToken);
  check("Guardian CANNOT access a different student's results (not their child)", otherResult.status === 403 || otherResult.status === 404, {
    status: otherResult.status,
    body: otherResult.body,
  });

  // ---- Cross-tenant: guardian token from Madrasa A used with Madrasa B's
  // slug must fail (mirrors Phase 1's admin-token test, for guardian auth) ----
  const crossTenant = await fetchAs(`/guardian/students/${STUDENT_WITH_PUBLISHED_RESULT}/results`, guardianToken, "e2e-test-madrasa-b");
  check("Guardian token + wrong madrasa slug is REJECTED", crossTenant.status === 401, {
    status: crossTenant.status,
    body: crossTenant.body,
  });

  if (!summary()) process.exit(1);
}

async function fetchAs(path: string, token: string, slug: string = SLUG_A) {
  const res = await fetch(`http://localhost:5190/api${path}`, {
    headers: { "X-Madrasa-Slug": slug, Authorization: `Bearer ${token}` },
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

main()
  .catch((e) => {
    console.error("PHASE 8 FAILED:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
