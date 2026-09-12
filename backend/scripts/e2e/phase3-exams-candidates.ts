import "dotenv/config";
import { login, get, post, check, summary, readFixtureState, writeFixtureState } from "./lib";

const PASSWORD = "E2eTest#2026!";
const SLUG_A = "e2e-test-madrasa-a";
const SLUG_B = "e2e-test-madrasa-b";
const CLASS_ID = 1;
const DIVISION_ID = 1;

async function createExam(slug: string, token: string, name: string) {
  const res = await post("/exams", { name, exam_type: "সাময়িক" }, { slug, token });
  check(`Create exam "${name}" for ${slug}`, res.status === 200 || res.status === 201, {
    status: res.status,
    body: res.body,
  });
}

async function findExamIdByName(slug: string, token: string, name: string): Promise<number> {
  const res = await get("/exams", { slug, token });
  const rows: any[] = res.body?.data ?? res.body ?? [];
  const match = rows.find((r) => r.name === name);
  check(`Find exam "${name}" id for ${slug}`, !!match, { rows: rows.map((r: any) => r.name) });
  return match?.id;
}

const sortNums = (arr: number[]) => [...arr].sort((a, b) => a - b);

/** Free-exam auto-registration trigger (A): creating an exam-routine for a
 * class synchronously auto-registers every active student in that
 * class(+division) as a candidate (see autoRegisterForRoutine in
 * exam-candidate.service.ts, called from routine.service.ts's
 * createExamRoutine) - no manual register/bulk-register step exists
 * anymore. */
async function createRoutineAndAutoRegister(
  slug: string,
  token: string,
  examId: number,
  subject: string,
  examDate: string,
) {
  return post(
    "/exam-routine",
    {
      exam_id: examId,
      class_id: CLASS_ID,
      division_id: DIVISION_ID,
      subject,
      exam_date: examDate,
      start_time: "09:00",
      end_time: "12:00",
    },
    { slug, token },
  );
}

async function main() {
  console.log("=== Phase 3: Exams + Automatic candidate registration ===");

  const tokenA = await login(SLUG_A, `talimat@${SLUG_A}.e2e-test`, PASSWORD);
  const tokenB = await login(SLUG_B, `talimat@${SLUG_B}.e2e-test`, PASSWORD);
  // TALIMAT's default permission set intentionally has no fee.* keys (fee
  // domain is ACCOUNTANT's/MUHTAMIM's per baseline-role-permissions.ts) - use
  // MUHTAMIM (bypasses all rbac checks) for the fee-structure/invoice calls
  // below, same convention phase4-cross-exam.ts already uses for the
  // reports.* endpoints TALIMAT also lacks.
  const tokenA_muhtamim = await login(SLUG_A, `muhtamim@${SLUG_A}.e2e-test`, PASSWORD);

  await createExam(SLUG_A, tokenA, "E2E Exam A1");
  await createExam(SLUG_A, tokenA, "E2E Exam A2");
  await createExam(SLUG_B, tokenB, "E2E Exam B1");

  const examA1Id = await findExamIdByName(SLUG_A, tokenA, "E2E Exam A1");
  const examA2Id = await findExamIdByName(SLUG_A, tokenA, "E2E Exam A2");
  const examB1Id = await findExamIdByName(SLUG_B, tokenB, "E2E Exam B1");

  const state = readFixtureState() as {
    studentsA?: number[];
    studentsB?: number[];
    sessionAId?: number;
    sessionBId?: number;
  };
  if (!state.studentsA?.length || !state.studentsB?.length || !state.sessionAId || !state.sessionBId) {
    throw new Error("Missing studentsA/studentsB/sessionAId/sessionBId in fixture state - run phase2-session-students.ts first");
  }
  const studentsA = state.studentsA;
  const studentsB = state.studentsB;
  const sessionAId = state.sessionAId;
  const sessionBId = state.sessionBId;

  // ================= Exam A1: FREE exam - whole class becomes candidates
  // the instant a routine is created for it. =================
  const routineA1 = await createRoutineAndAutoRegister(SLUG_A, tokenA, examA1Id, "E2E-A1-Routine-Subject", "2026-10-01");
  check(
    "Create exam-routine for Exam A1 (free exam - triggers auto-registration of the whole class)",
    routineA1.status === 200 || routineA1.status === 201,
    { status: routineA1.status, body: routineA1.body },
  );

  // Registration is synchronous with the routine-create request (see
  // autoRegisterForRoutine - a plain awaited call inside
  // RoutineService.createExamRoutine, no queue/job involved) - so no
  // polling/waiting is needed before this list reflects the new candidates.
  const listA1 = await get(`/exam-candidates?exam_id=${examA1Id}`, { slug: SLUG_A, token: tokenA });
  const rowsA1: any[] = listA1.body?.data ?? [];
  const idsA1 = sortNums(rowsA1.map((r) => r.studentId));
  check(
    "Exam A1 auto-registered exactly the 6 Madrasa A students (all, since it's a free exam)",
    JSON.stringify(idsA1) === JSON.stringify(sortNums(studentsA)),
    { idsA1, expected: sortNums(studentsA) },
  );

  // ================= Exam B1: FREE exam - same pattern, Madrasa B. =================
  const routineB1 = await createRoutineAndAutoRegister(SLUG_B, tokenB, examB1Id, "E2E-B1-Routine-Subject", "2026-10-01");
  check(
    "Create exam-routine for Exam B1 (free exam - triggers auto-registration of the whole class)",
    routineB1.status === 200 || routineB1.status === 201,
    { status: routineB1.status, body: routineB1.body },
  );

  const listB1 = await get(`/exam-candidates?exam_id=${examB1Id}`, { slug: SLUG_B, token: tokenB });
  const rowsB1: any[] = listB1.body?.data ?? [];
  const idsB1 = sortNums(rowsB1.map((r) => r.studentId));
  check(
    "Exam B1 auto-registered exactly the 4 Madrasa B students (all, since it's a free exam)",
    JSON.stringify(idsB1) === JSON.stringify(sortNums(studentsB)),
    { idsB1, expected: sortNums(studentsB) },
  );

  // ================= Exam A2: FEE-LINKED exam - only students whose
  // invoice for this exam's fee structure reaches full PAID status become
  // candidates. We deliberately pay off only 3 of the 6 Madrasa A students'
  // invoices (studentsA[0..2]) and leave the other 3 (studentsA[3..5])
  // unpaid, to create the exact partial-vs-full distinction Phase 4's
  // cross-exam isolation test depends on. =================
  const feeStructureRes = await post(
    "/fee-structures",
    {
      name: "E2E Exam A2 Fee",
      amount: 500,
      frequency: "ONE_TIME",
      class_id: CLASS_ID,
      session_id: sessionAId,
      exam_id: examA2Id,
    },
    { slug: SLUG_A, token: tokenA_muhtamim },
  );
  check("Create fee structure linked to Exam A2", feeStructureRes.status === 200 || feeStructureRes.status === 201, {
    status: feeStructureRes.status,
    body: feeStructureRes.body,
  });

  const structuresList = await get(`/fee-structures?class_id=${CLASS_ID}&session_id=${sessionAId}`, {
    slug: SLUG_A,
    token: tokenA_muhtamim,
  });
  const structures: any[] = structuresList.body?.data ?? [];
  const examA2Structure = structures.find((s) => s.name === "E2E Exam A2 Fee");
  check("Found the Exam A2 fee structure id", !!examA2Structure, { names: structures.map((s) => s.name) });
  const feeStructureId = examA2Structure?.id;

  // "বিদ্যমান সব ছাত্রের ফি সেট করুন" backfill - includeExamLinked=true
  // internally, so this is what actually bills the exam-linked fee to
  // every active student in the class (all 6 Madrasa A students).
  const backfillRes = await post(
    "/invoices/backfill",
    { class_id: CLASS_ID, session_id: sessionAId },
    { slug: SLUG_A, token: tokenA_muhtamim },
  );
  check("Backfill invoices for class 1 / session A", backfillRes.status === 200, {
    status: backfillRes.status,
    body: backfillRes.body,
  });
  // NOTE: invoicesCreated is NOT "6" here - class 1/session A already has 4
  // pre-existing baseline fee structures (ভর্তি ফি/মাসিক বেতন/পরীক্ষার ফি/
  // বোর্ডিং ফি, seeded independently of this test) alongside the exam-linked
  // one just created, so backfill correctly bills all 5 structures x 6
  // students = 30 invoices. Assert on studentsProcessed instead of hardcoding
  // an invoice count that depends on however many unrelated fee structures
  // happen to exist for this class/session.
  check(
    "Backfill processed all 6 Madrasa A students with no failures",
    backfillRes.body?.data?.studentsProcessed === 6 && backfillRes.body?.data?.failed === 0,
    { body: backfillRes.body },
  );

  // Fully pay off the invoice for only the first 3 Madrasa A students.
  const payTargets = studentsA.slice(0, 3);
  const stillPending = studentsA.slice(3, 6);
  for (const studentId of payTargets) {
    const invoicesRes = await get(`/invoices?student_id=${studentId}`, { slug: SLUG_A, token: tokenA_muhtamim });
    const invoices: any[] = invoicesRes.body?.data ?? [];
    const invoice = invoices.find((inv) => inv.feeStructureId === feeStructureId);
    check(`Found Exam A2 fee invoice for student ${studentId}`, !!invoice, { studentId, invoiceCount: invoices.length });
    if (!invoice) continue;

    const payRes = await post(
      `/invoices/${invoice.id}/pay`,
      { amount: invoice.amount, method: "CASH" },
      { slug: SLUG_A, token: tokenA_muhtamim },
    );
    check(
      `Fully pay Exam A2 invoice for student ${studentId} (fires auto-registration on PAID)`,
      payRes.status === 200 && payRes.body?.data?.invoiceStatus === "PAID",
      { status: payRes.status, body: payRes.body },
    );
  }

  const listA2 = await get(`/exam-candidates?exam_id=${examA2Id}`, { slug: SLUG_A, token: tokenA });
  const rowsA2: any[] = listA2.body?.data ?? [];
  const idsA2 = sortNums(rowsA2.map((r) => r.studentId));
  check(
    "Exam A2 auto-registered exactly the 3 fully-paid Madrasa A students (not the other 3)",
    JSON.stringify(idsA2) === JSON.stringify(sortNums(payTargets)),
    { idsA2, expected: sortNums(payTargets) },
  );

  // The other 3 (unpaid) students must still show up as "not yet a
  // candidate" on the eligible-students screen for Exam A2.
  const eligibleA2 = await get(`/exam-candidates/eligible-students?exam_id=${examA2Id}&class_id=${CLASS_ID}`, {
    slug: SLUG_A,
    token: tokenA,
  });
  const eligibleIds = sortNums((eligibleA2.body?.data ?? []).map((r: any) => r.student_id));
  check(
    "Eligible-students for Exam A2 lists exactly the 3 still-unpaid students as pending",
    JSON.stringify(eligibleIds) === JSON.stringify(sortNums(stillPending)),
    { eligibleIds, expected: sortNums(stillPending) },
  );

  console.log(JSON.stringify({ examA1Id, examA2Id, examB1Id, studentsA, studentsB }, null, 2));

  // Persist for later phases (4, 6, 7, 9, 10, 11...) that need these ids
  // instead of re-deriving/hardcoding them.
  writeFixtureState({ examA1Id, examA2Id, examB1Id });

  if (!summary()) process.exit(1);
}

main().catch((e) => {
  console.error("PHASE 3 FAILED:", e);
  process.exit(1);
});
