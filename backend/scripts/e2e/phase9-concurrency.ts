import "dotenv/config";
import { prisma } from "../../src/shared/database/prisma";
import { login, post, check, summary, readFixtureState } from "./lib";

const PASSWORD = "E2eTest#2026!";
const SLUG_A = "e2e-test-madrasa-a";
const CLASS_ID = 1;
const DIVISION_ID = 1;

async function main() {
  console.log("=== Phase 9: Concurrency / race conditions ===");

  const state = readFixtureState() as { madrasaAId?: number; examA1Id?: number };
  if (!state.madrasaAId || !state.examA1Id) {
    throw new Error("Missing madrasaAId/examA1Id in fixture state - run phase0/phase3 first");
  }
  const madrasaAId = state.madrasaAId;
  const EXAM_A1 = state.examA1Id;

  const tokenA = await login(SLUG_A, `talimat@${SLUG_A}.e2e-test`, PASSWORD);
  const tokenMuhtamim = await login(SLUG_A, `muhtamim@${SLUG_A}.e2e-test`, PASSWORD);

  // ================= 1. Double invigilator booking (cross-routine time
  // overlap, SERIALIZABLE transaction fix) =================
  const teacher = await prisma.teacher.create({
    data: { madrasaId: madrasaAId, divisionId: DIVISION_ID, registrationNo: 900001, nameBn: "E2E শিক্ষক" },
  });

  // Two DIFFERENT exam-routine slots on the SAME date with OVERLAPPING
  // times (09:00-11:00 and 10:00-12:00) - the same person can't invigilate
  // both.
  const r1 = await post(
    "/exam-routine",
    { exam_id: EXAM_A1, class_id: CLASS_ID, division_id: DIVISION_ID, subject: "E2E-Overlap-Subject-1", exam_date: "2026-12-01", start_time: "09:00", end_time: "11:00" },
    { slug: SLUG_A, token: tokenA },
  );
  const r2 = await post(
    "/exam-routine",
    { exam_id: EXAM_A1, class_id: CLASS_ID, division_id: DIVISION_ID, subject: "E2E-Overlap-Subject-2", exam_date: "2026-12-01", start_time: "10:00", end_time: "12:00" },
    { slug: SLUG_A, token: tokenA },
  );
  check("Create overlapping routine slot 1", r1.status === 200 || r1.status === 201, { body: r1.body });
  check("Create overlapping routine slot 2", r2.status === 200 || r2.status === 201, { body: r2.body });

  const routines = await prisma.examRoutine.findMany({
    where: { madrasaId: madrasaAId, examId: EXAM_A1, subject: { in: ["E2E-Overlap-Subject-1", "E2E-Overlap-Subject-2"] } },
    select: { id: true, subject: true },
  });
  const routine1 = routines.find((r) => r.subject === "E2E-Overlap-Subject-1")?.id;
  const routine2 = routines.find((r) => r.subject === "E2E-Overlap-Subject-2")?.id;
  check("Found both overlapping routine ids", !!routine1 && !!routine2, { routine1, routine2 });

  // Sequential control: assigning the SAME teacher to both overlapping
  // slots one after another must be blocked on the second attempt.
  const assign1 = await post("/exam-invigilators", { exam_routine_id: routine1, invigilator_type: "TEACHER", invigilator_id: teacher.id }, { slug: SLUG_A, token: tokenA });
  check("Assign teacher to slot 1 succeeds", assign1.status === 200 || assign1.status === 201, { body: assign1.body });
  const assign2 = await post("/exam-invigilators", { exam_routine_id: routine2, invigilator_type: "TEACHER", invigilator_id: teacher.id }, { slug: SLUG_A, token: tokenA });
  check("Assigning the SAME teacher to an overlapping slot 2 is BLOCKED", assign2.status === 409, {
    status: assign2.status,
    body: assign2.body,
  });

  // True concurrency: a SECOND teacher, assigned to both overlapping slots
  // via two SIMULTANEOUS requests - the SERIALIZABLE transaction fix
  // should ensure at most one wins.
  const teacher2 = await prisma.teacher.create({
    data: { madrasaId: madrasaAId, divisionId: DIVISION_ID, registrationNo: 900002, nameBn: "E2E শিক্ষক ২" },
  });
  const [concurrent1, concurrent2] = await Promise.all([
    post("/exam-invigilators", { exam_routine_id: routine1, invigilator_type: "TEACHER", invigilator_id: teacher2.id }, { slug: SLUG_A, token: tokenA }),
    post("/exam-invigilators", { exam_routine_id: routine2, invigilator_type: "TEACHER", invigilator_id: teacher2.id }, { slug: SLUG_A, token: tokenA }),
  ]);
  const succeededCount = [concurrent1, concurrent2].filter((r) => r.status === 200 || r.status === 201).length;
  check(
    "Concurrent double-booking: at most ONE of the two simultaneous requests succeeds",
    succeededCount <= 1,
    { concurrent1: { status: concurrent1.status, body: concurrent1.body }, concurrent2: { status: concurrent2.status, body: concurrent2.body } },
  );
  const actualAssignments = await prisma.examInvigilatorAssignment.count({
    where: { madrasaId: madrasaAId, invigilatorType: "TEACHER", invigilatorId: teacher2.id, status: { not: "CANCELLED" } },
  });
  check("Database confirms teacher2 is assigned to at most 1 of the 2 overlapping slots", actualAssignments <= 1, {
    actualAssignments,
  });

  // ================= 2. Simultaneous result-status transition (double
  // publish attempt on the SAME already-locked result must not corrupt
  // anything - both should fail cleanly since it's already LOCKED) =================
  const rm = await prisma.resultMaster.findFirst({ where: { madrasaId: madrasaAId, examId: EXAM_A1, classId: CLASS_ID } });
  check("Found the Phase 6 result master (already LOCKED)", rm?.status === "LOCKED", { status: rm?.status });
  if (rm) {
    const [lock1, lock2] = await Promise.all([
      post(`/results/${rm.id}/lock`, {}, { slug: SLUG_A, token: tokenA }),
      post(`/results/${rm.id}/lock`, {}, { slug: SLUG_A, token: tokenMuhtamim }),
    ]);
    check("Both concurrent lock attempts on an already-LOCKED result fail cleanly (no 200)", lock1.status !== 200 && lock2.status !== 200, {
      lock1: lock1.status,
      lock2: lock2.status,
    });
  }

  if (!summary()) process.exit(1);
}

main()
  .catch((e) => {
    console.error("PHASE 9 FAILED:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
