import "dotenv/config";
import { login, get, check, summary } from "./lib";

const PASSWORD = "E2eTest#2026!";
const SLUG_A = "e2e-test-madrasa-a";

async function main() {
  console.log("=== Phase 10: Light regression check (untouched pre-existing modules) ===");
  const tokenA = await login(SLUG_A, `talimat@${SLUG_A}.e2e-test`, PASSWORD);
  const tokenMuhtamim = await login(SLUG_A, `muhtamim@${SLUG_A}.e2e-test`, PASSWORD);

  const students = await get("/students", { slug: SLUG_A, token: tokenA });
  check("Student list endpoint still works", students.status === 200, { status: students.status });

  const teachers = await get("/teachers", { slug: SLUG_A, token: tokenA });
  check("Teacher list endpoint still works", teachers.status === 200, { status: teachers.status });

  // division_id is a required query param (class-panel.service.ts's
  // listClasses throws BadRequestError without it) - not optional, so it
  // must be passed here.
  const classes = await get("/madrasa-classes?division_id=1", { slug: SLUG_A, token: tokenA });
  check("Class list endpoint still works", classes.status === 200, { status: classes.status });

  const sessions = await get("/sessions", { slug: SLUG_A, token: tokenA });
  check("Session list endpoint still works", sessions.status === 200, { status: sessions.status });

  const attendance = await get("/attendance", { slug: SLUG_A, token: tokenA });
  check("Attendance endpoint still reachable (200 or a benign validation 400, not 500)", attendance.status !== 500, {
    status: attendance.status,
  });

  const accounts = await get("/accounts", { slug: SLUG_A, token: tokenMuhtamim });
  check("Accounts endpoint still reachable (MUHTAMIM, not 500)", accounts.status !== 500, { status: accounts.status });

  const roles = await get("/roles", { slug: SLUG_A, token: tokenMuhtamim });
  check("Roles & Permissions endpoint still reachable (not 500)", roles.status !== 500, { status: roles.status });

  if (!summary()) process.exit(1);
}

main().catch((e) => {
  console.error("PHASE 10 FAILED:", e);
  process.exit(1);
});
