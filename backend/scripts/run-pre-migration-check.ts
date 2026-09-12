import "dotenv/config";
import { PrismaClient } from "@prisma/client";

// Read-only diagnostic run of pre-migration-check.sql's checks via Prisma
// Client instead of a psql/`prisma db execute` file run (that command
// doesn't print SELECT results, and the file uses psql's \echo which isn't
// plain SQL). Every query here is COUNT-only / ID-only - no writes, no PII.

const prisma = new PrismaClient();

async function main() {
  const results: Record<string, unknown> = {};

  results["1_orphan_exam_rooms"] = await prisma.$queryRaw`
    SELECT count(*)::int AS n FROM exam_rooms er
    WHERE NOT EXISTS (SELECT 1 FROM madrasas m WHERE m.id = er.madrasa_id)
  `;

  results["2_orphan_invigilator_assignments"] = await prisma.$queryRaw`
    SELECT count(*)::int AS n FROM exam_invigilator_assignments t
    WHERE NOT EXISTS (SELECT 1 FROM madrasas m WHERE m.id = t.madrasa_id)
  `;

  results["3_orphan_seat_allocations"] = await prisma.$queryRaw`
    SELECT count(*)::int AS n FROM exam_seat_allocations t
    WHERE NOT EXISTS (SELECT 1 FROM madrasas m WHERE m.id = t.madrasa_id)
       OR NOT EXISTS (SELECT 1 FROM exam_candidates c WHERE c.id = t.exam_candidate_id)
  `;

  results["4_orphan_exam_attendances"] = await prisma.$queryRaw`
    SELECT count(*)::int AS n FROM exam_attendances t
    WHERE NOT EXISTS (SELECT 1 FROM madrasas m WHERE m.id = t.madrasa_id)
       OR NOT EXISTS (SELECT 1 FROM exam_candidates c WHERE c.id = t.exam_candidate_id)
  `;

  results["5_invalid_exam_routine_divisions"] = await prisma.$queryRaw`
    SELECT count(*)::int AS n FROM exam_routines t
    WHERE t.division_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM divisions d WHERE d.id = t.division_id)
  `;

  results["6_invalid_mark_component_exam_ids"] = await prisma.$queryRaw`
    SELECT count(*)::int AS n FROM mark_component_configs t
    WHERE t.exam_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM exams e WHERE e.id = t.exam_id)
  `;

  results["7_exams_marks_missing_madrasa_id"] = await prisma.$queryRaw`
    SELECT
      (SELECT count(*)::int FROM exams WHERE madrasa_id IS NULL) AS exams_missing_madrasa_id,
      (SELECT count(*)::int FROM marks WHERE madrasa_id IS NULL) AS marks_missing_madrasa_id
  `;

  results["8_duplicate_pending_corrections"] = await prisma.$queryRaw`
    SELECT count(*)::int AS n FROM (
      SELECT result_master_id, student_id, book_id, field, count(*) AS c
      FROM result_corrections
      WHERE status = 'PENDING'
      GROUP BY result_master_id, student_id, book_id, field
      HAVING count(*) > 1
    ) dupes
  `;

  results["9_exam_candidates_bad_refs"] = await prisma.$queryRaw`
    SELECT
      (SELECT count(*)::int FROM exam_candidates ec WHERE NOT EXISTS (SELECT 1 FROM exams e WHERE e.id = ec.exam_id)) AS candidates_with_bad_exam_id,
      (SELECT count(*)::int FROM exam_candidates ec WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.id = ec.student_id)) AS candidates_with_bad_student_id
  `;

  // Serialize BigInt-free (we cast ::int above) - plain JSON.stringify is safe.
  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((e) => {
    console.error("PRE-MIGRATION CHECK FAILED TO RUN:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
