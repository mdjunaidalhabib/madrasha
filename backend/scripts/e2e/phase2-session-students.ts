import "dotenv/config";
import { prisma } from "../../src/shared/database/prisma";
import { login, get, check, summary, readFixtureState, writeFixtureState } from "./lib";

const PASSWORD = "E2eTest#2026!";
const SLUG_A = "e2e-test-madrasa-a";
const SLUG_B = "e2e-test-madrasa-b";
const DIVISION_ID = 1;
const CLASS_ID = 1;

async function getCurrentSharedSession(slug: string, token: string) {
  // superAdminService.createMadrasa's provisioning already creates a
  // division_id=NULL ("shared") active session per madrasa at creation time
  // (that's what ExamPanel's createExam looks up via
  // sessionRepository.findCurrentSession(madrasaId), which only matches
  // division_id IS NULL) - reuse it via the real GET /sessions endpoint
  // instead of creating a duplicate.
  const list = await get("/sessions", { slug, token });
  check(`List sessions for ${slug}`, list.status === 200, { status: list.status, body: list.body });
  const rows: any[] = list.body?.data ?? list.body ?? [];
  const shared = rows.find((r) => r.division_id == null || r.divisionId == null);
  check(`Found existing shared (division-less) active session for ${slug}`, !!shared, { rows });
  return shared?.id;
}

async function createStudents(madrasaId: number, sessionId: number, namePrefix: string, count: number) {
  const ids: number[] = [];
  for (let i = 1; i <= count; i++) {
    const student = await prisma.student.create({
      data: {
        madrasaId,
        divisionId: DIVISION_ID,
        classId: CLASS_ID,
        sessionId,
        nameBn: `${namePrefix} ছাত্র ${i}`,
        roll: i,
        registrationNo: madrasaId * 1000 + i,
        academicYear: "2026",
        fatherName: `${namePrefix} পিতা ${i}`,
        guardianPhone: `017${String(madrasaId).padStart(2, "0")}${String(i).padStart(6, "0")}`,
      },
    });
    ids.push(student.id);
  }
  return ids;
}

async function main() {
  console.log("=== Phase 2: Session + Students setup ===");

  const state = readFixtureState() as { madrasaAId?: number; madrasaBId?: number };
  if (!state.madrasaAId || !state.madrasaBId) {
    throw new Error("Missing madrasaAId/madrasaBId in fixture state - run phase0-provision.ts first");
  }
  const madrasaAId = state.madrasaAId;
  const madrasaBId = state.madrasaBId;

  const tokenA = await login(SLUG_A, `talimat@${SLUG_A}.e2e-test`, PASSWORD);
  const tokenB = await login(SLUG_B, `talimat@${SLUG_B}.e2e-test`, PASSWORD);

  const sessionAId = await getCurrentSharedSession(SLUG_A, tokenA);
  const sessionBId = await getCurrentSharedSession(SLUG_B, tokenB);

  check("Session A has a valid id", Number.isInteger(sessionAId), { sessionAId });
  check("Session B has a valid id", Number.isInteger(sessionBId), { sessionBId });

  const studentsA = await createStudents(madrasaAId, sessionAId, "A", 6);
  const studentsB = await createStudents(madrasaBId, sessionBId, "B", 4);

  check("Created 6 students for Madrasa A", studentsA.length === 6);
  check("Created 4 students for Madrasa B", studentsB.length === 4);

  // Persist the actual created ids - phase3 used to assume a fixed PK range
  // (403-412), which drifted the moment auto-increment moved on (see lib.ts's
  // fixture-state comment).
  writeFixtureState({ studentsA, studentsB, sessionAId, sessionBId });

  console.log(JSON.stringify({ sessionAId, sessionBId, studentsA, studentsB }, null, 2));

  if (!summary()) process.exit(1);
}

main()
  .catch((e) => {
    console.error("PHASE 2 FAILED:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
