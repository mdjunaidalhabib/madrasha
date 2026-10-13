import "dotenv/config";
import { prisma } from "../../src/shared/database/prisma";
import { login, post, check, summary, readFixtureState, writeFixtureState } from "./lib";

const PASSWORD = "E2eTest#2026!";
const SLUG_A = "e2e-test-madrasa-a";
const CLASS_ID = 1;
const BOOKS = [2, 3, 4]; // Bangla, English, Gonit

async function main() {
  console.log("=== Phase 6: Marks -> Result workflow (submit/verify/process/publish) ===");

  const state = readFixtureState() as { examA1Id?: number; studentsA?: number[] };
  if (!state.examA1Id || !state.studentsA?.length) {
    throw new Error("Missing examA1Id/studentsA in fixture state - run phase2/phase3 first");
  }
  const EXAM_A1 = state.examA1Id;
  const STUDENTS_A = state.studentsA;

  const tokenTalimat = await login(SLUG_A, `talimat@${SLUG_A}.e2e-test`, PASSWORD);
  const tokenMuhtamim = await login(SLUG_A, `muhtamim@${SLUG_A}.e2e-test`, PASSWORD);

  // ---- 1. Create/get result session ----
  const sessionRes = await post("/results/session", { exam_id: EXAM_A1, class_id: CLASS_ID }, { slug: SLUG_A, token: tokenTalimat });
  check("Create/get result session", sessionRes.status === 200, { status: sessionRes.status, body: sessionRes.body });
  const resultMasterId = sessionRes.body?.result_master_id;
  check("Got a result_master_id", Number.isInteger(resultMasterId), { resultMasterId });

  // ---- 2. Enter marks for all 6 students x 3 books ----
  const data = STUDENTS_A.flatMap((studentId) =>
    BOOKS.map((bookId) => ({
      student_id: studentId,
      exam_id: EXAM_A1,
      class_id: CLASS_ID,
      book_id: bookId,
      mark: 70 + (studentId % 10),
    })),
  );
  const saveMarksRes = await post("/results/marks", { result_master_id: resultMasterId, data }, { slug: SLUG_A, token: tokenTalimat });
  check("Save marks for 6 students x 3 books", saveMarksRes.status === 200, { status: saveMarksRes.status, body: saveMarksRes.body });

  // ---- 3. Submit each book (TALIMAT) ----
  for (const bookId of BOOKS) {
    const res = await post(`/results/${resultMasterId}/books/${bookId}/submit`, {}, { slug: SLUG_A, token: tokenTalimat });
    check(`Submit book ${bookId}`, res.status === 200, { status: res.status, body: res.body });
  }

  // ---- 4. SEPARATION OF DUTIES: same user (TALIMAT) verifying their own
  // submission must be BLOCKED ----
  const selfVerify = await post(`/results/${resultMasterId}/books/${BOOKS[0]}/verify`, {}, { slug: SLUG_A, token: tokenTalimat });
  check(
    "Self-verify by the same user who submitted is BLOCKED",
    selfVerify.status === 409 || selfVerify.status === 400,
    { status: selfVerify.status, body: selfVerify.body },
  );

  // ---- 5. MUHTAMIM (privileged, bypasses separation-of-duties) verifies
  // all 3 books ----
  for (const bookId of BOOKS) {
    const res = await post(`/results/${resultMasterId}/books/${bookId}/verify`, {}, { slug: SLUG_A, token: tokenMuhtamim });
    check(`Verify book ${bookId} (as MUHTAMIM, privileged override)`, res.status === 200, { status: res.status, body: res.body });
  }

  // ---- 6. Process result ----
  const processRes = await post("/results/process", { exam_id: EXAM_A1, class_id: CLASS_ID, result_master_id: resultMasterId }, { slug: SLUG_A, token: tokenTalimat });
  check("Process result", processRes.status === 200, { status: processRes.status, body: processRes.body });

  // ---- 7. Publish (runs the pre-publish sanity check; no separate verify/approve steps) ----
  const publishRes = await post("/results/publish", { result_master_id: resultMasterId }, { slug: SLUG_A, token: tokenTalimat });
  check("Publish result", publishRes.status === 200, { status: publishRes.status, body: publishRes.body });

  // ---- 8. Attempt to edit marks on a PUBLISHED result -
  // must be BLOCKED by the fix from this session (saveMarks now checks
  // master.status, not just per-book MarkSubmission state) ----
  const editAfterPublish = await post(
    "/results/marks",
    { result_master_id: resultMasterId, data: [{ student_id: STUDENTS_A[0], exam_id: EXAM_A1, class_id: CLASS_ID, book_id: BOOKS[0], mark: 99 }] },
    { slug: SLUG_A, token: tokenTalimat },
  );
  check("Editing marks on a PUBLISHED result is BLOCKED", editAfterPublish.status === 409, {
    status: editAfterPublish.status,
    body: editAfterPublish.body,
  });

  // ---- 8b. Publishing an already-PUBLISHED result again must be BLOCKED ----
  const doublePublish = await post("/results/publish", { result_master_id: resultMasterId }, { slug: SLUG_A, token: tokenTalimat });
  check("Publishing an already-PUBLISHED result is BLOCKED", doublePublish.status === 409, {
    status: doublePublish.status,
    body: doublePublish.body,
  });

  // ---- 9. Correction workflow: request a correction on the published
  // result, then decide it (as a DIFFERENT user than the requester) ----
  const requestCorrection = await post(
    `/results/${resultMasterId}/corrections`,
    { student_id: STUDENTS_A[0], book_id: BOOKS[0], field: "mark", new_value: "95", reason: "E2E correction test" },
    { slug: SLUG_A, token: tokenTalimat },
  );
  check("Request a correction on the published result", requestCorrection.status === 200, {
    status: requestCorrection.status,
    body: requestCorrection.body,
  });
  const correctionId = requestCorrection.body?.correction_id;

  // Duplicate pending correction request for the SAME target - should be
  // blocked by this session's new partial unique index.
  const dupeCorrection = await post(
    `/results/${resultMasterId}/corrections`,
    { student_id: STUDENTS_A[0], book_id: BOOKS[0], field: "mark", new_value: "88", reason: "E2E duplicate test" },
    { slug: SLUG_A, token: tokenTalimat },
  );
  check("Duplicate PENDING correction request for the same target is BLOCKED", dupeCorrection.status === 409, {
    status: dupeCorrection.status,
    body: dupeCorrection.body,
  });

  // Self-decide (same user who requested) must be blocked.
  const selfDecide = await post(`/results/corrections/${correctionId}/decide`, { approve: true }, { slug: SLUG_A, token: tokenTalimat });
  check("Self-decide (same user who requested) is BLOCKED", selfDecide.status === 409, {
    status: selfDecide.status,
    body: selfDecide.body,
  });

  // Decide as a different (privileged) user - should succeed and actually
  // apply the correction.
  const decide = await post(`/results/corrections/${correctionId}/decide`, { approve: true }, { slug: SLUG_A, token: tokenMuhtamim });
  check("Decide (approve) correction as a different user succeeds", decide.status === 200, {
    status: decide.status,
    body: decide.body,
  });

  const markAfterCorrection = await prisma.mark.findFirst({
    where: { resultMasterId, studentId: STUDENTS_A[0], bookId: BOOKS[0] },
    select: { mark: true },
  });
  check("Mark was actually corrected to 95 in the database", Number(markAfterCorrection?.mark) === 95, {
    markAfterCorrection,
  });

  console.log(JSON.stringify({ resultMasterId, correctionId }, null, 2));

  writeFixtureState({ resultMasterIdA1: resultMasterId });

  if (!summary()) process.exit(1);
}

main()
  .catch((e) => {
    console.error("PHASE 6 FAILED:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
