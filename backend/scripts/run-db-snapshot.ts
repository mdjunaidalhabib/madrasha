import "dotenv/config";
import { PrismaClient } from "@prisma/client";

// Read-only environment snapshot - row counts only, no PII - to help judge
// whether the configured DATABASE_URL looks like a live/production dataset
// or a near-empty staging/test one, before running any write-based
// verification against it.

const prisma = new PrismaClient();

async function main() {
  const counts = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT
      (SELECT count(*)::int FROM madrasas) AS madrasas,
      (SELECT count(*)::int FROM madrasas WHERE deleted_at IS NULL) AS madrasas_not_deleted,
      (SELECT count(*)::int FROM students) AS students,
      (SELECT count(*)::int FROM exams) AS exams,
      (SELECT count(*)::int FROM exam_candidates) AS exam_candidates,
      (SELECT count(*)::int FROM exam_rooms) AS exam_rooms,
      (SELECT count(*)::int FROM exam_seat_allocations) AS exam_seat_allocations,
      (SELECT count(*)::int FROM exam_attendances) AS exam_attendances,
      (SELECT count(*)::int FROM results_master) AS results_master,
      (SELECT count(*)::int FROM results_master WHERE status = 'PUBLISHED') AS results_published,
      (SELECT count(*)::int FROM results_master WHERE status = 'LOCKED') AS results_locked,
      (SELECT count(*)::int FROM users) AS users,
      (SELECT count(*)::int FROM guardians) AS guardians
  `;

  // No raw names printed (avoid exposing real institution identity in logs)
  // - just a signal of whether this looks like synthetic/test data.
  const madrasaSignals = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE name ILIKE '%test%' OR name ILIKE '%demo%' OR slug ILIKE '%test%' OR slug ILIKE '%demo%')::int AS looks_like_test,
      min(created_at) AS oldest_created_at,
      max(created_at) AS newest_created_at
    FROM madrasas
  `;

  console.log(JSON.stringify({ counts: counts[0], madrasaSignals: madrasaSignals[0] }, null, 2));
}

main()
  .catch((e) => {
    console.error("SNAPSHOT FAILED:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
