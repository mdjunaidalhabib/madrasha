import "dotenv/config";
import { prisma } from "../../src/shared/database/prisma";
import { login, get, post, check, summary, readFixtureState, writeFixtureState } from "./lib";

const PASSWORD = "E2eTest#2026!";
const SLUG_A = "e2e-test-madrasa-a";
const DIVISION_ID = 1;
const CLASS_ID = 1;
const BULK_STUDENT_COUNT = 200;

async function main() {
  console.log("=== Phase 5: Bulk-scale test (200+ candidates, seat allocation, attendance) ===");

  const state = readFixtureState() as { madrasaAId?: number; sessionAId?: number };
  if (!state.madrasaAId || !state.sessionAId) {
    throw new Error("Missing madrasaAId/sessionAId in fixture state - run phase0-provision.ts and phase2-session-students.ts first");
  }
  const madrasaAId = state.madrasaAId;
  const sessionAId = state.sessionAId;

  const tokenA = await login(SLUG_A, `talimat@${SLUG_A}.e2e-test`, PASSWORD);

  // ---- 1. Create 200 students directly (fast fixture setup - student
  // creation itself is a pre-existing, unrelated module) ----
  const studentIds: number[] = [];
  const data = Array.from({ length: BULK_STUDENT_COUNT }, (_, i) => ({
    madrasaId: madrasaAId,
    divisionId: DIVISION_ID,
    classId: CLASS_ID,
    sessionId: sessionAId,
    nameBn: `বাল্ক ছাত্র ${i + 1}`,
    roll: 1000 + i,
    registrationNo: madrasaAId * 1000 + 100 + i,
    academicYear: "2026",
  }));
  await prisma.student.createMany({ data });
  const created = await prisma.student.findMany({
    where: { madrasaId: madrasaAId, roll: { gte: 1000, lt: 1000 + BULK_STUDENT_COUNT } },
    select: { id: true },
  });
  studentIds.push(...created.map((s) => s.id));
  check(`Created ${BULK_STUDENT_COUNT} bulk students`, studentIds.length === BULK_STUDENT_COUNT, {
    count: studentIds.length,
  });

  // ---- 2. Create the bulk exam ----
  const examRes = await post("/exams", { name: "E2E Bulk Exam", exam_type: "বার্ষিক" }, { slug: SLUG_A, token: tokenA });
  check("Create bulk exam", examRes.status === 200 || examRes.status === 201, { body: examRes.body });
  const examsList = await get("/exams", { slug: SLUG_A, token: tokenA });
  const bulkExam = (examsList.body?.data ?? examsList.body ?? []).find((r: any) => r.name === "E2E Bulk Exam");
  check("Found bulk exam id", !!bulkExam, { bulkExam });
  const bulkExamId = bulkExam?.id;

  // ---- 3. Create an exam-routine slot for this exam+class - this is a
  // FREE exam (no fee structure linked), so the routine-create request
  // synchronously auto-registers every currently-active student in the
  // class as a candidate (see autoRegisterForRoutine in
  // exam-candidate.service.ts). The manual bulk-register endpoint this
  // step used to call no longer exists. Created BEFORE the rooms below
  // (order no longer matters functionally - seat allocation looks up
  // rooms by id, not creation order - but this keeps "trigger
  // registration, then verify it" as one visible step). ----
  const routineRes = await post(
    "/exam-routine",
    {
      exam_id: bulkExamId,
      class_id: CLASS_ID,
      division_id: DIVISION_ID,
      subject: "Bangla",
      exam_date: "2026-11-01",
      start_time: "09:00",
      end_time: "12:00",
    },
    { slug: SLUG_A, token: tokenA },
  );
  check(
    "Create exam routine slot (free exam - triggers auto-registration of all 200 pre-existing students)",
    routineRes.status === 200 || routineRes.status === 201,
    { body: routineRes.body },
  );
  const routineList = await get(`/exam-routine?exam_id=${bulkExamId}&class_id=${CLASS_ID}`, { slug: SLUG_A, token: tokenA });
  const routine = (routineList.body?.data ?? [])[0];
  check("Found created routine id", !!routine?.id, { routine });
  const routineId = routine?.id;

  // ---- 3b. Verify auto-registration actually picked up all 200 students
  // that existed BEFORE the routine was created (autoRegisterForRoutine
  // queries the live active-student pool at routine-creation time, not a
  // snapshot taken earlier - this proves that, not just "any registration
  // happened"). ----
  const registeredCount = await prisma.examCandidate.count({
    where: { madrasaId: madrasaAId, examId: bulkExamId, studentId: { in: studentIds } },
  });
  check(
    "Auto-registration picked up all 200 pre-existing bulk students (not just ones created after the routine)",
    registeredCount === BULK_STUDENT_COUNT,
    { registeredCount },
  );

  // ---- 4. Create 2 rooms (100 capacity each) ----
  const room1 = await post("/exam-rooms", { name: "E2E Room 1", code: "E2E-R1", capacity: 100 }, { slug: SLUG_A, token: tokenA });
  const room2 = await post("/exam-rooms", { name: "E2E Room 2", code: "E2E-R2", capacity: 100 }, { slug: SLUG_A, token: tokenA });
  check("Create room 1", room1.status === 200 || room1.status === 201, { body: room1.body });
  check("Create room 2", room2.status === 200 || room2.status === 201, { body: room2.body });
  const roomsList = await get("/exam-rooms", { slug: SLUG_A, token: tokenA });
  const rooms: any[] = roomsList.body?.data ?? [];
  const room1Id = rooms.find((r: any) => r.code === "E2E-R1")?.id;
  const room2Id = rooms.find((r: any) => r.code === "E2E-R2")?.id;
  check("Found both room ids", !!room1Id && !!room2Id, { room1Id, room2Id });

  // ---- 5. Auto-allocate seats for all 200 candidates across 2 rooms -
  // exercises this session's bulk UPDATE...FROM(VALUES) fix for
  // candidate_no mirroring (previously N sequential $executeRaw calls). ----
  const allocateStart = Date.now();
  const allocateRes = await post(
    "/exam-seats/allocate",
    { exam_routine_id: routineId, room_ids: [room1Id, room2Id], strategy: "SEQUENTIAL" },
    { slug: SLUG_A, token: tokenA },
  );
  const allocateMs = Date.now() - allocateStart;
  check("Auto-allocate seats for 200 candidates succeeds", allocateRes.status === 200, {
    status: allocateRes.status,
    body: allocateRes.body,
    ms: allocateMs,
  });
  check("Auto-allocate reports 200 allocated", allocateRes.body?.data?.allocated === BULK_STUDENT_COUNT, {
    body: allocateRes.body,
  });
  console.log(`  (seat allocation took ${allocateMs}ms for ${BULK_STUDENT_COUNT} candidates)`);

  // ---- 6. Verify candidate_no was mirrored onto ALL 200 ExamCandidate rows ----
  const mirroredCount = await prisma.examCandidate.count({
    where: { madrasaId: madrasaAId, examId: bulkExamId, candidateNo: { not: null } },
  });
  check("All 200 candidates got candidate_no mirrored (bulk UPDATE worked)", mirroredCount === BULK_STUDENT_COUNT, {
    mirroredCount,
  });

  // ---- 7. Verify no duplicate seat numbers within a room for this slot ----
  const seatRows = await prisma.seatAllocation.findMany({
    where: { madrasaId: madrasaAId, examRoutineId: routineId },
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

  // ---- 8. Bulk attendance: mark all 200 present in one call ----
  // Scoped to studentIds (this run's own 200 bulk students), same as the
  // registeredCount check above - class 1 also has phase2/3's own 6 active
  // fixture students, who auto-register for ANY new routine created on
  // this class too (see autoRegisterForRoutine's "every active student in
  // the class" rule). An unscoped query here previously picked up all 206
  // candidates for this exam and tripped the bulk-attendance endpoint's
  // 200-item request-body cap.
  const candidateRows = await prisma.examCandidate.findMany({
    where: { madrasaId: madrasaAId, examId: bulkExamId, studentId: { in: studentIds } },
    select: { id: true },
  });
  const attendanceEntries = candidateRows.map((c) => ({ exam_candidate_id: c.id, status: "PRESENT" }));
  const bulkAttendance = await post(
    "/exam-attendance/bulk",
    { exam_routine_id: routineId, entries: attendanceEntries },
    { slug: SLUG_A, token: tokenA },
  );
  check("Bulk attendance for 200 candidates succeeds", bulkAttendance.status === 200, {
    status: bulkAttendance.status,
    body: bulkAttendance.body,
  });
  check("Bulk attendance reports 200 marked", bulkAttendance.body?.data?.marked === BULK_STUDENT_COUNT, {
    body: bulkAttendance.body,
  });

  // Deactivate the 200 bulk students now that this phase's own checks (all
  // read from ExamCandidate/SeatAllocation/ExamAttendance directly, never
  // gated on Student.isActive) are done. Every ResultPanel/ResultWorkflow
  // "is marks entry complete" check is scoped to "every ACTIVE student in
  // this classId" (findActiveStudentsInClass/findStudentsMissingMarkForBook -
  // a pre-existing, repo-wide convention, not specific to this feature), and
  // classId here is the SAME class phase2/phase6/phase7/phase9 use for their
  // own focused 6-student exam - without this, those 200 extra active
  // students would permanently block phase6 from ever completing a submit
  // (it only enters marks for its own 6 students), breaking every phase
  // downstream of it.
  const deactivated = await prisma.student.updateMany({
    where: { id: { in: studentIds } },
    data: { isActive: 0 },
  });
  check("Deactivated all 200 bulk students (keeps class 1's active roster at 6 for later phases)", deactivated.count === BULK_STUDENT_COUNT, {
    count: deactivated.count,
  });

  console.log(JSON.stringify({ bulkExamId, room1Id, room2Id, routineId }, null, 2));

  writeFixtureState({ bulkExamId, room1Id, room2Id, routineId });

  if (!summary()) process.exit(1);
}

main()
  .catch((e) => {
    console.error("PHASE 5 FAILED:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
