import "dotenv/config";
import { prisma } from "../../src/shared/database/prisma";
import { login, post, check, summary, readFixtureState } from "./lib";

const PASSWORD = "E2eTest#2026!";
const SLUG_A = "e2e-test-madrasa-a";
const BULK_STUDENT_COUNT = 200;

async function main() {
  console.log("=== Phase 5b: Retry seat allocation with the collision fix ===");

  const state = readFixtureState() as {
    madrasaAId?: number;
    bulkExamId?: number;
    routineId?: number;
    room1Id?: number;
    room2Id?: number;
  };
  if (!state.madrasaAId || !state.bulkExamId || !state.routineId || !state.room1Id || !state.room2Id) {
    throw new Error("Missing madrasaAId/bulkExamId/routineId/room1Id/room2Id in fixture state - run phase5-bulk-scale.ts first");
  }
  const madrasaAId = state.madrasaAId;
  const BULK_EXAM_ID = state.bulkExamId;
  const ROUTINE_ID = state.routineId;
  const ROOM1_ID = state.room1Id;
  const ROOM2_ID = state.room2Id;

  const tokenA = await login(SLUG_A, `talimat@${SLUG_A}.e2e-test`, PASSWORD);

  const allocateStart = Date.now();
  const allocateRes = await post(
    "/exam-seats/allocate",
    { exam_routine_id: ROUTINE_ID, room_ids: [ROOM1_ID, ROOM2_ID], strategy: "SEQUENTIAL" },
    { slug: SLUG_A, token: tokenA },
  );
  const allocateMs = Date.now() - allocateStart;
  check("Auto-allocate seats for 200 candidates across 2 rooms succeeds", allocateRes.status === 200, {
    status: allocateRes.status,
    body: allocateRes.body,
  });
  check("Auto-allocate reports 200 allocated", allocateRes.body?.data?.allocated === BULK_STUDENT_COUNT, {
    body: allocateRes.body,
  });
  console.log(`  (seat allocation took ${allocateMs}ms for ${BULK_STUDENT_COUNT} candidates across 2 rooms)`);

  const mirroredCount = await prisma.examCandidate.count({
    where: { madrasaId: madrasaAId, examId: BULK_EXAM_ID, candidateNo: { not: null } },
  });
  check("All 200 candidates got a room-qualified candidate_no mirrored", mirroredCount === BULK_STUDENT_COUNT, {
    mirroredCount,
  });

  // Scoped to candidateNo != null and ordered deterministically: class 1
  // also has phase2/3's own 6 active fixture students, who auto-register
  // for this exam's routine too (same "every active student in the class"
  // rule as phase5), pushing the true candidate count to 206 against only
  // 200 seats (2 rooms x 100) - those 6 never get a seat/candidate_no at
  // all, which is a capacity fact, not a format bug. An unscoped,
  // unordered query here previously had no guarantee against landing on
  // exactly those 6 nulls.
  const sample = await prisma.examCandidate.findMany({
    where: { madrasaId: madrasaAId, examId: BULK_EXAM_ID, candidateNo: { not: null } },
    select: { candidateNo: true },
    orderBy: { id: "asc" },
    take: 5,
  });
  console.log("Sample candidate_no values:", sample.map((s) => s.candidateNo));
  check(
    "candidate_no values are room-qualified (contain a '-')",
    sample.every((s) => s.candidateNo?.includes("-")),
    { sample },
  );

  const seatRows = await prisma.seatAllocation.findMany({
    where: { madrasaId: madrasaAId, examRoutineId: ROUTINE_ID },
    select: { roomId: true, seatNo: true },
  });
  const seen = new Set<string>();
  let duplicates = 0;
  for (const s of seatRows) {
    const key = `${s.roomId}:${s.seatNo}`;
    if (seen.has(key)) duplicates++;
    seen.add(key);
  }
  check("No duplicate seat numbers within any room", duplicates === 0, { duplicates, totalSeats: seatRows.length });
  check("Exactly 200 seat rows created", seatRows.length === BULK_STUDENT_COUNT, { count: seatRows.length });
  check("Room 1 got 100 seats, Room 2 got 100 seats", seatRows.filter(s => s.roomId === ROOM1_ID).length === 100 && seatRows.filter(s => s.roomId === ROOM2_ID).length === 100, {
    room1: seatRows.filter(s => s.roomId === ROOM1_ID).length,
    room2: seatRows.filter(s => s.roomId === ROOM2_ID).length,
  });

  if (!summary()) process.exit(1);
}

main()
  .catch((e) => {
    console.error("PHASE 5b FAILED:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
