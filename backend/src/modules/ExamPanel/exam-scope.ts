import { prisma } from "../../shared/database/prisma";
import { BadRequestError } from "../../shared/errors";

/**
 * বিভাগভিত্তিক পরীক্ষার guard. An exam with no ExamDivision rows is held for
 * সকল বিভাগ; otherwise only the listed divisions may get routines/marks for
 * it. The class's own division (Class.divisionId) decides - never a
 * client-supplied division id.
 *
 * Kept prisma-direct (not via ExamService) so routine/result modules can use
 * it without pulling in ExamService's fee-service dependency graph.
 */
export async function assertExamCoversClass(madrasaId: number, examId: number, classId: number): Promise<void> {
  const [exam, cls] = await Promise.all([
    prisma.exam.findFirst({
      where: { id: examId, madrasaId, deletedAt: null },
      select: { divisions: { select: { divisionId: true } } },
    }),
    prisma.class.findUnique({ where: { id: classId }, select: { divisionId: true } }),
  ]);

  // Missing exam/class is left to the caller's own not-found handling.
  if (!exam || !exam.divisions.length) return;

  const divisionId = cls?.divisionId ?? null;
  if (divisionId === null || !exam.divisions.some((d) => d.divisionId === divisionId)) {
    throw new BadRequestError("এই পরীক্ষাটি নির্বাচিত শ্রেণির বিভাগের জন্য নির্ধারিত নয়");
  }
}
