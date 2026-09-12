import "dotenv/config";
import { prisma } from "../../src/shared/database/prisma";
import { login, get, check, summary, readFixtureState } from "./lib";

const PASSWORD = "E2eTest#2026!";
const SLUG_A = "e2e-test-madrasa-a";

async function main() {
  console.log("=== Phase 7: Eligibility precedence (canCandidateParticipate) ===");

  const state = readFixtureState() as { madrasaAId?: number; examA2Id?: number; studentsA?: number[] };
  if (!state.madrasaAId || !state.examA2Id || !state.studentsA?.length) {
    throw new Error("Missing madrasaAId/examA2Id/studentsA in fixture state - run phase0/phase2/phase3 first");
  }
  const madrasaAId = state.madrasaAId;
  const EXAM_A2 = state.examA2Id; // 3 candidates: studentsA[0..2]
  const [student1, student2, student3, student4] = state.studentsA; // student4 registered for A1 only, not A2

  // MUHTAMIM used for report endpoints - TALIMAT's default role has no
  // reports.* permissions at all (pre-existing, unrelated to exam work;
  // see Phase 4's identical note).
  const tokenA = await login(SLUG_A, `muhtamim@${SLUG_A}.e2e-test`, PASSWORD);

  const candidates = await prisma.examCandidate.findMany({
    where: { madrasaId: madrasaAId, examId: EXAM_A2 },
    orderBy: { studentId: "asc" },
  });
  check("Exam A2 has 3 candidates to test with", candidates.length === 3, { count: candidates.length });
  const [c1, c2, c3] = candidates; // studentsA[0..2]

  // ---- Scenario 1: REGISTERED + ELIGIBLE -> allowed ----
  await prisma.examCandidate.update({ where: { id: c1.id }, data: { status: "REGISTERED", eligibilityStatus: "ELIGIBLE" } });

  // ---- Scenario 2: REGISTERED + INELIGIBLE -> not allowed (no admit card) ----
  await prisma.examCandidate.update({ where: { id: c2.id }, data: { status: "REGISTERED", eligibilityStatus: "INELIGIBLE" } });

  // ---- Scenario 3: CANCELLED + ELIGIBLE -> not allowed regardless ----
  await prisma.examCandidate.update({ where: { id: c3.id }, data: { status: "CANCELLED", eligibilityStatus: "ELIGIBLE" } });

  // Fetch admit cards for Exam A2 - only c1 (student1) should appear.
  const admit = await get(`/reports/student/admit-cards?exam_id=${EXAM_A2}`, { slug: SLUG_A, token: tokenA });
  const admitIds: number[] = (admit.body?.data ?? []).map((r: any) => r.id ?? r.student_id);
  check(
    "Admit cards: only the ELIGIBLE+REGISTERED candidate (student1) appears",
    JSON.stringify(admitIds.sort()) === JSON.stringify([student1]),
    { admitIds },
  );
  check("Admit cards: INELIGIBLE candidate (student2) does NOT appear", !admitIds.includes(student2), { admitIds });
  check("Admit cards: CANCELLED candidate (student3) does NOT appear", !admitIds.includes(student3), { admitIds });

  // Candidate LIST report (management roster) should still show all 3
  // (including INELIGIBLE) but NOT the CANCELLED one - per the documented
  // distinction in exam-candidate.policy.ts / findExamCandidateList.
  const list = await get(`/reports/academic/exam-candidates?exam_id=${EXAM_A2}`, { slug: SLUG_A, token: tokenA });
  const listIds: number[] = (list.body?.data ?? []).map((r: any) => r.id ?? r.student_id);
  check("Candidate list (roster): shows REGISTERED+ELIGIBLE (student1)", listIds.includes(student1), { listIds });
  check("Candidate list (roster): STILL shows REGISTERED+INELIGIBLE (student2) for office visibility", listIds.includes(student2), { listIds });
  check("Candidate list (roster): does NOT show CANCELLED (student3)", !listIds.includes(student3), { listIds });

  // ---- Scenario 4: WITHHELD -> not allowed ----
  await prisma.examCandidate.update({ where: { id: c1.id }, data: { status: "WITHHELD", eligibilityStatus: "ELIGIBLE" } });
  const admit2 = await get(`/reports/student/admit-cards?exam_id=${EXAM_A2}`, { slug: SLUG_A, token: tokenA });
  const admitIds2: number[] = (admit2.body?.data ?? []).map((r: any) => r.id ?? r.student_id);
  check("Admit cards: WITHHELD candidate (student1, now withheld) does NOT appear", !admitIds2.includes(student1), { admitIds2 });

  // ---- Scenario 5: Unregistered student must not appear as a candidate ----
  // student4 is a real Madrasa A student but was never registered for
  // Exam A2 (only registered for A1).
  const admit3 = await get(`/reports/student/admit-cards?exam_id=${EXAM_A2}`, { slug: SLUG_A, token: tokenA });
  const admitIds3: number[] = (admit3.body?.data ?? []).map((r: any) => r.id ?? r.student_id);
  check("Admit cards: unregistered student (student4) never appears for Exam A2", !admitIds3.includes(student4), { admitIds3 });

  const list3 = await get(`/reports/academic/exam-candidates?exam_id=${EXAM_A2}`, { slug: SLUG_A, token: tokenA });
  const listIds3: number[] = (list3.body?.data ?? []).map((r: any) => r.id ?? r.student_id);
  check("Candidate list: unregistered student (student4) never appears for Exam A2", !listIds3.includes(student4), { listIds3 });

  // Restore c1 to a clean state for any later use.
  await prisma.examCandidate.update({ where: { id: c1.id }, data: { status: "REGISTERED", eligibilityStatus: "ELIGIBLE" } });

  if (!summary()) process.exit(1);
}

main()
  .catch((e) => {
    console.error("PHASE 7 FAILED:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
