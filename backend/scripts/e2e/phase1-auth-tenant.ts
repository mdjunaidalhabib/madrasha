import "dotenv/config";
import { login, get, check, summary } from "./lib";

const PASSWORD = "E2eTest#2026!";
const SLUG_A = "e2e-test-madrasa-a";
const SLUG_B = "e2e-test-madrasa-b";

async function main() {
  console.log("=== Phase 1: Auth + tenant isolation ===");

  const tokenA_talimat = await login(SLUG_A, `talimat@${SLUG_A}.e2e-test`, PASSWORD);
  check("Login as Madrasa A TALIMAT succeeds", !!tokenA_talimat);

  const tokenA_muhtamim = await login(SLUG_A, `muhtamim@${SLUG_A}.e2e-test`, PASSWORD);
  check("Login as Madrasa A MUHTAMIM succeeds", !!tokenA_muhtamim);

  const tokenB_talimat = await login(SLUG_B, `talimat@${SLUG_B}.e2e-test`, PASSWORD);
  check("Login as Madrasa B TALIMAT succeeds", !!tokenB_talimat);

  // The core cross-tenant attack: use Madrasa A's valid token, but send
  // Madrasa B's slug header. authMiddleware must reject this (401) - the
  // token is bound to the madrasa_id it was issued for. /exams is used
  // instead of /dashboard, which additionally requires an active
  // subscription (unrelated to tenant isolation) that these fresh test
  // madrasas don't have.
  const crossTenant = await get("/exams", { slug: SLUG_B, token: tokenA_talimat });
  check(
    "Madrasa A's token + Madrasa B's slug header is REJECTED (401)",
    crossTenant.status === 401,
    { status: crossTenant.status, body: crossTenant.body },
  );

  // Sanity: the same token against ITS OWN madrasa's slug must succeed.
  const sameTenant = await get("/exams", { slug: SLUG_A, token: tokenA_talimat });
  check("Madrasa A's token + Madrasa A's own slug succeeds", sameTenant.status === 200, {
    status: sameTenant.status,
    body: sameTenant.body,
  });

  // No token at all must be rejected.
  const noAuth = await get("/exams", { slug: SLUG_A });
  check("No Authorization header is rejected (401)", noAuth.status === 401, { status: noAuth.status });

  console.log(
    JSON.stringify(
      { tokenA_talimat, tokenA_muhtamim, tokenB_talimat },
      null,
      2,
    ),
  );

  if (!summary()) process.exit(1);
}

main().catch((e) => {
  console.error("PHASE 1 FAILED:", e);
  process.exit(1);
});
