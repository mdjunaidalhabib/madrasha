import "dotenv/config";
import { login, get, check, summary, readFixtureState } from "./lib";

const PASSWORD = "E2eTest#2026!";
const SLUG_A = "e2e-test-madrasa-a";

async function main() {
  console.log("=== Phase 11: Seat plan / invigilator list / attendance sheet reports ===");

  const state = readFixtureState() as { bulkExamId?: number; examA1Id?: number };
  if (!state.bulkExamId || !state.examA1Id) {
    throw new Error("Missing bulkExamId/examA1Id in fixture state - run phase3/phase5 first");
  }
  const BULK_EXAM_ID = state.bulkExamId;
  const EXAM_A1 = state.examA1Id;

  const token = await login(SLUG_A, `muhtamim@${SLUG_A}.e2e-test`, PASSWORD);

  const seatPlan = await get(`/reports/academic/seat-plan?exam_id=${BULK_EXAM_ID}`, { slug: SLUG_A, token });
  check("Seat plan report returns 200", seatPlan.status === 200, { status: seatPlan.status, body: typeof seatPlan.body });
  const seatRows: any[] = seatPlan.body?.data ?? [];
  check("Seat plan report returns 200 rows (matches Phase 5's bulk allocation)", seatRows.length === 200, { count: seatRows.length });
  check("Seat plan rows have room_name and seat_no populated", !!seatRows[0]?.room_name && !!seatRows[0]?.seat_no, { sample: seatRows[0] });

  const invigilatorList = await get(`/reports/academic/invigilator-list?exam_id=${EXAM_A1}`, { slug: SLUG_A, token });
  check("Invigilator list report returns 200", invigilatorList.status === 200, { status: invigilatorList.status });
  const invRows: any[] = invigilatorList.body?.data ?? [];
  check("Invigilator list has at least 1 row (Phase 9's teacher assignment)", invRows.length >= 1, { count: invRows.length, sample: invRows[0] });
  check("Invigilator row has invigilator_name populated", !!invRows[0]?.invigilator_name, { sample: invRows[0] });

  const attendanceSheet = await get(`/reports/academic/exam-attendance-sheet?exam_id=${BULK_EXAM_ID}`, { slug: SLUG_A, token });
  check("Exam attendance sheet report returns 200", attendanceSheet.status === 200, { status: attendanceSheet.status });
  const attRows: any[] = attendanceSheet.body?.data ?? [];
  check("Attendance sheet returns 200 rows (matches Phase 5's bulk attendance)", attRows.length === 200, { count: attRows.length });
  check("Attendance rows show status PRESENT", attRows[0]?.status === "PRESENT", { sample: attRows[0] });

  if (!summary()) process.exit(1);
}

main().catch((e) => {
  console.error("PHASE 11 FAILED:", e);
  process.exit(1);
});
