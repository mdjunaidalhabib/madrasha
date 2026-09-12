import "dotenv/config";
import { prisma } from "../../src/shared/database/prisma";
import { login, get, post, check, summary, readFixtureState } from "./lib";

const PASSWORD = "E2eTest#2026!";
const SLUG_A = "e2e-test-madrasa-a";

async function main() {
  console.log("=== Phase 11b: Seat plan / attendance sheet - minimal live proof on Exam A1 ===");

  const state = readFixtureState() as { examA1Id?: number; studentsA?: number[]; madrasaAId?: number };
  if (!state.examA1Id || !state.studentsA?.length || !state.madrasaAId) {
    throw new Error("Missing examA1Id/studentsA/madrasaAId in fixture state - run phase0/phase2/phase3 first");
  }
  const EXAM_A1 = state.examA1Id;
  const STUDENTS_A = state.studentsA;
  const MADRASA_A_ID = state.madrasaAId;
  const token = await login(SLUG_A, `talimat@${SLUG_A}.e2e-test`, PASSWORD);
  const tokenMuhtamim = await login(SLUG_A, `muhtamim@${SLUG_A}.e2e-test`, PASSWORD);

  const room = await post("/exam-rooms", { name: "E2E Room A1", code: "E2E-A1-R", capacity: 20 }, { slug: SLUG_A, token });
  check("Create room for A1", room.status === 200 || room.status === 201, { body: room.body });
  const roomsList = await get("/exam-rooms", { slug: SLUG_A, token });
  const roomId = (roomsList.body?.data ?? []).find((r: any) => r.code === "E2E-A1-R")?.id;

  const routines = await get(`/exam-routine?exam_id=${EXAM_A1}`, { slug: SLUG_A, token });
  const routineId = (routines.body?.data ?? [])[0]?.id;
  check("Found an existing routine for Exam A1", !!routineId, { routineId });

  const allocate = await post("/exam-seats/allocate", { exam_routine_id: routineId, room_ids: [roomId], strategy: "SEQUENTIAL" }, { slug: SLUG_A, token });
  check("Allocate seats for Exam A1's routine", allocate.status === 200, { body: allocate.body });

  const seatPlan = await get(`/reports/academic/seat-plan?exam_id=${EXAM_A1}`, { slug: SLUG_A, token: tokenMuhtamim });
  const seatRows: any[] = seatPlan.body?.data ?? [];
  check("Seat plan report now shows real rows for Exam A1", seatRows.length > 0, { count: seatRows.length, sample: seatRows[0] });
  check("Seat plan row has room_name and seat_no", !!seatRows[0]?.room_name && !!seatRows[0]?.seat_no, { sample: seatRows[0] });

  // Queried directly (not via the paginated list endpoint) and scoped to
  // STUDENTS_A (phase2/3's own 6 active fixture students for this exam) -
  // class 1's routine also carries candidates auto-registered by OTHER
  // phases sharing the same class (phase5/5b's 200 bulk students, since
  // deactivated; phase9's overlap-routine tests), pushing this exam's total
  // past 200 candidates. The list endpoint's default page (50 rows, sorted
  // by student_id descending) doesn't even contain our low-id fixture
  // students, so an API-paginated "first 2 rows" pick would either land on
  // an unrelated deactivated bulk candidate or come back empty.
  const candidates = await prisma.examCandidate.findMany({
    where: { madrasaId: MADRASA_A_ID, examId: EXAM_A1, studentId: { in: STUDENTS_A } },
    select: { id: true },
    take: 2,
  });
  const entries = candidates.map((c) => ({ exam_candidate_id: c.id, status: "PRESENT" }));
  const bulkAttendance = await post("/exam-attendance/bulk", { exam_routine_id: routineId, entries }, { slug: SLUG_A, token });
  check("Mark attendance for a couple of Exam A1 candidates", bulkAttendance.status === 200, { body: bulkAttendance.body });

  const attendanceSheet = await get(`/reports/academic/exam-attendance-sheet?exam_id=${EXAM_A1}`, { slug: SLUG_A, token: tokenMuhtamim });
  const attRows: any[] = attendanceSheet.body?.data ?? [];
  check("Attendance sheet report now shows real rows for Exam A1", attRows.length > 0, { count: attRows.length, sample: attRows[0] });
  check("Attendance row shows status PRESENT", attRows.some((r: any) => r.status === "PRESENT"), { sample: attRows[0] });

  if (!summary()) process.exit(1);
}

main()
  .catch((e) => {
    console.error("PHASE 11b FAILED:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
