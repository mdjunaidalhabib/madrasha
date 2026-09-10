import { prisma } from "../../shared/database/prisma";

export class ExamSeatRepository {
  findByRoutine(madrasaId: number, examRoutineId: number) {
    return prisma.seatAllocation.findMany({
      where: { madrasaId, examRoutineId },
      orderBy: [{ roomId: "asc" }, { seatNo: "asc" }],
      include: { room: { select: { name: true, code: true } } },
    });
  }

  findById(id: number, madrasaId: number) {
    return prisma.seatAllocation.findFirst({ where: { id, madrasaId } });
  }

  findRoomsByIds(madrasaId: number, roomIds: number[]) {
    return prisma.examRoom.findMany({ where: { madrasaId, id: { in: roomIds }, isActive: true } });
  }

  findRoutineForAllocation(id: number, madrasaId: number) {
    return prisma.examRoutine.findFirst({
      where: { id, madrasaId },
      select: { id: true, examId: true, classId: true, divisionId: true },
    });
  }

  /** Registered/eligible candidates for a routine's exam+class(+division),
   * sourced from ExamCandidate (the Exam Core/Candidate module's table).
   * Plain raw query since ExamCandidate isn't a Prisma relation from this
   * module - see the file-level note in exam-operations.prisma for why. */
  findEligibleCandidatesForRoutine(madrasaId: number, examId: number, classId: number, divisionId: number | null) {
    return prisma.$queryRaw<{ id: number; roll: number | null }[]>`
      SELECT ec.id AS id, s.roll AS roll
      FROM exam_candidates ec
      JOIN students s ON s.id = ec.student_id
      WHERE ec.madrasa_id = ${madrasaId}
        AND ec.exam_id = ${examId}
        AND ec.class_id = ${classId}
        AND (${divisionId}::int IS NULL OR ec.division_id = ${divisionId})
        AND ec.status IN ('REGISTERED', 'ELIGIBLE')
      ORDER BY s.roll ASC NULLS LAST
    `;
  }

  findManualOverridesForRoutine(madrasaId: number, examRoutineId: number) {
    return prisma.seatAllocation.findMany({
      where: { madrasaId, examRoutineId, isManualOverride: true },
      select: { examCandidateId: true, roomId: true },
    });
  }

  async replaceAllocations(
    madrasaId: number,
    examRoutineId: number,
    plan: { examCandidateId: number; roomId: number; seatNo: string }[],
    strategy: string,
    preserveManualOverrides: boolean,
  ) {
    await prisma.$transaction(async (tx) => {
      await tx.seatAllocation.deleteMany({
        where: { madrasaId, examRoutineId, ...(preserveManualOverrides ? { isManualOverride: false } : {}) },
      });
      if (plan.length) {
        await tx.seatAllocation.createMany({
          data: plan.map((p) => ({ madrasaId, examRoutineId, strategy: strategy as any, ...p })),
        });
        for (const p of plan) {
          // Mirror the assigned seat number onto ExamCandidate.candidateNo
          // - that field's own doc-comment anticipates exactly this (see
          // exam-operations.prisma's SeatAllocation model comment).
          await tx.$executeRaw`UPDATE exam_candidates SET candidate_no = ${p.seatNo} WHERE id = ${p.examCandidateId}`;
        }
      }
    });
  }

  updateSeat(id: number, madrasaId: number, data: Record<string, unknown>) {
    return prisma.seatAllocation.updateMany({ where: { id, madrasaId }, data });
  }

  async setCandidateNo(examCandidateId: number, seatNo: string) {
    await prisma.$executeRaw`UPDATE exam_candidates SET candidate_no = ${seatNo} WHERE id = ${examCandidateId}`;
  }

  clearByRoutine(madrasaId: number, examRoutineId: number) {
    return prisma.seatAllocation.deleteMany({ where: { madrasaId, examRoutineId } });
  }
}

export const examSeatRepository = new ExamSeatRepository();
