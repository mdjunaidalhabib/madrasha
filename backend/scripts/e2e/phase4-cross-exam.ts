import "dotenv/config";
import { login, get, check, summary, readFixtureState } from "./lib";

const PASSWORD = "E2eTest#2026!";
const SLUG_A = "e2e-test-madrasa-a";
const SLUG_B = "e2e-test-madrasa-b";

async function main() {
  console.log("=== Phase 4: Cross-exam isolation ===");

  const state = readFixtureState() as {
    examA1Id?: number;
    examA2Id?: number;
    examB1Id?: number;
    studentsA?: number[];
    studentsB?: number[];
  };
  if (!state.examA1Id || !state.examA2Id || !state.examB1Id || !state.studentsA?.length || !state.studentsB?.length) {
    throw new Error("Missing exam/student ids in fixture state - run phase2/phase3 first");
  }
  const EXAM_A1 = state.examA1Id;
  const EXAM_A2 = state.examA2Id;
  const EXAM_B1 = state.examB1Id;
  const STUDENTS_A = state.studentsA;
  const STUDENTS_A2_ONLY = state.studentsA.slice(0, 3); // A2 registered only the first 3 (see phase3)
  const STUDENTS_B = state.studentsB;

  const tokenA = await login(SLUG_A, `talimat@${SLUG_A}.e2e-test`, PASSWORD);
  const tokenB = await login(SLUG_B, `talimat@${SLUG_B}.e2e-test`, PASSWORD);
  // TALIMAT's default permission set has no reports.* keys at all (a
  // pre-existing baseline-role-permissions.ts fact, unrelated to the exam
  // work) - use MUHTAMIM (bypasses all permission checks) for the
  // report/admit-card endpoints below so this test verifies the report
  // QUERY's exam-scoping correctness, not TALIMAT's report-access grant.
  const tokenA_muhtamim = await login(SLUG_A, `muhtamim@${SLUG_A}.e2e-test`, PASSWORD);

  // exam-candidates internal list (exam-candidate module)
  const listA1 = await get(`/exam-candidates?exam_id=${EXAM_A1}`, { slug: SLUG_A, token: tokenA });
  const listA2 = await get(`/exam-candidates?exam_id=${EXAM_A2}`, { slug: SLUG_A, token: tokenA });
  check("Exam A1 candidate list has exactly 6 candidates", listA1.body?.pagination?.total === 6, {
    pagination: listA1.body?.pagination,
  });
  check("Exam A2 candidate list has exactly 3 candidates", listA2.body?.pagination?.total === 3, {
    pagination: listA2.body?.pagination,
  });

  const rowsA1: any[] = listA1.body?.data?.rows ?? listA1.body?.data ?? [];
  const rowsA2: any[] = listA2.body?.data?.rows ?? listA2.body?.data ?? [];
  const studentIdsA1 = rowsA1.map((r) => r.studentId ?? r.student_id).sort();
  const studentIdsA2 = rowsA2.map((r) => r.studentId ?? r.student_id).sort();
  check("Exam A1's candidates are exactly the 6 Madrasa A students", JSON.stringify(studentIdsA1) === JSON.stringify([...STUDENTS_A].sort()), {
    studentIdsA1,
  });
  check("Exam A2's candidates are exactly the 3-student subset (no bleed from A1)", JSON.stringify(studentIdsA2) === JSON.stringify([...STUDENTS_A2_ONLY].sort()), {
    studentIdsA2,
  });

  // reports.repository.ts's findExamCandidateList (the report fixed in this
  // session) - academic/exam-candidates report
  const reportA1 = await get(`/reports/academic/exam-candidates?exam_id=${EXAM_A1}`, { slug: SLUG_A, token: tokenA_muhtamim });
  const reportA2 = await get(`/reports/academic/exam-candidates?exam_id=${EXAM_A2}`, { slug: SLUG_A, token: tokenA_muhtamim });
  const reportRowsA1: any[] = reportA1.body?.data ?? [];
  const reportRowsA2: any[] = reportA2.body?.data ?? [];
  check("Report: Exam A1 candidate report returns 6 rows", reportRowsA1.length === 6, {
    count: reportRowsA1.length,
  });
  check("Report: Exam A2 candidate report returns 3 rows (not 6)", reportRowsA2.length === 3, {
    count: reportRowsA2.length,
  });

  // findStudentAdmitCards (the critical fix this session) - admit cards
  const admitA1 = await get(`/reports/student/admit-cards?exam_id=${EXAM_A1}`, { slug: SLUG_A, token: tokenA_muhtamim });
  const admitA2 = await get(`/reports/student/admit-cards?exam_id=${EXAM_A2}`, { slug: SLUG_A, token: tokenA_muhtamim });
  const admitRowsA1: any[] = admitA1.body?.data ?? [];
  const admitRowsA2: any[] = admitA2.body?.data ?? [];
  check("Admit cards: Exam A1 returns 6 candidates", admitRowsA1.length === 6, { count: admitRowsA1.length, body: admitA1.body });
  check("Admit cards: Exam A2 returns 3 candidates (not 6, not mixed with A1)", admitRowsA2.length === 3, {
    count: admitRowsA2.length,
    body: admitA2.body,
  });
  const admitStudentIdsA2 = admitRowsA2.map((r) => r.id ?? r.student_id).sort((a, b) => a - b);
  check(
    "Admit cards for A2 are exactly the 3-student subset",
    JSON.stringify(admitStudentIdsA2) === JSON.stringify([...STUDENTS_A2_ONLY].sort((a, b) => a - b)),
    { admitStudentIdsA2 },
  );

  // Madrasa B's exam must never appear in Madrasa A's queries and vice
  // versa - already structurally guaranteed by madrasaId scoping, but
  // confirm Madrasa B's candidate list is exactly its own 4 students.
  const listB1 = await get(`/exam-candidates?exam_id=${EXAM_B1}`, { slug: SLUG_B, token: tokenB });
  const rowsB1: any[] = listB1.body?.data?.rows ?? listB1.body?.data ?? [];
  const studentIdsB1 = rowsB1.map((r) => r.studentId ?? r.student_id).sort();
  check("Exam B1's candidates are exactly the 4 Madrasa B students", JSON.stringify(studentIdsB1) === JSON.stringify([...STUDENTS_B].sort()), {
    studentIdsB1,
  });

  if (!summary()) process.exit(1);
}

main().catch((e) => {
  console.error("PHASE 4 FAILED:", e);
  process.exit(1);
});
