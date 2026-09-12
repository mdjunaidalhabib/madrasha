import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const constraints = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT conname, conrelid::regclass::text AS table_name, contype
    FROM pg_constraint
    WHERE conname IN (
      'exam_rooms_madrasa_id_fkey',
      'exam_invigilator_assignments_madrasa_id_fkey',
      'exam_seat_allocations_madrasa_id_fkey',
      'exam_seat_allocations_exam_candidate_id_fkey',
      'exam_attendances_madrasa_id_fkey',
      'exam_attendances_exam_candidate_id_fkey',
      'exam_routines_division_id_fkey',
      'mark_component_configs_exam_id_fkey'
    )
    ORDER BY conname
  `;

  const index = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT indexname, indexdef FROM pg_indexes WHERE indexname = 'uniq_pending_result_correction'
  `;

  const defaults = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT table_name, column_name, column_default
    FROM information_schema.columns
    WHERE table_name IN ('exams', 'marks') AND column_name = 'madrasa_id'
  `;

  console.log(JSON.stringify({ constraints, index, defaults }, null, 2));
}

main()
  .catch((e) => {
    console.error("VERIFY FAILED:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
