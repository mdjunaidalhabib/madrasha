import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { examCandidateParticipationSql } from "../exam-candidate/exam-candidate.policy";

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

  /** Candidates for a routine's exam+class(+division) allowed to receive a
   * NEW seat allocation, sourced from ExamCandidate. Uses the canonical
   * participation rule (see exam-candidate.policy.ts) - excludes CANCELLED/
   * WITHHELD status AND eligibilityStatus = INELIGIBLE, not just status
   * alone (the old condition here only checked status, so a REGISTERED
   * candidate the eligibility engine had already flagged INELIGIBLE could
   * still get seated). Plain raw query since ExamCandidate isn't included
   * via a Prisma `include` in this module's other queries. */
  findEligibleCandidatesForRoutine(madrasaId: number, examId: number, classId: number, divisionId: number | null) {
    return prisma.$queryRaw<{ id: number; roll: number | null }[]>`
      SELECT ec.id AS id, s.roll AS roll
      FROM exam_candidates ec
      JOIN students s ON s.id = ec.student_id
      WHERE ec.madrasa_id = ${madrasaId}
        AND ec.exam_id = ${examId}
        AND ec.class_id = ${classId}
        AND (${divisionId}::int IS NULL OR ec.division_id = ${divisionId})
        AND ${Prisma.raw(examCandidateParticipationSql())}
      ORDER BY s.roll ASC NULLS LAST
    `;
  }

  findManualOverridesForRoutine(madrasaId: number, examRoutineId: number) {
    return prisma.seatAllocation.findMany({
      where: { madrasaId, examRoutineId, isManualOverride: true },
      select: { examCandidateId: true, roomId: true },
    });
  }

  /** `roomCodeById` resolves each plan row's room to its display code, so
   * the mirrored ExamCandidate.candidateNo (see below) is room-qualified. */
  async replaceAllocations(
    madrasaId: number,
    examRoutineId: number,
    plan: { examCandidateId: number; roomId: number; seatNo: string }[],
    strategy: string,
    preserveManualOverrides: boolean,
    roomCodeById: Map<number, string>,
  ) {
    await prisma.$transaction(async (tx) => {
      await tx.seatAllocation.deleteMany({
        where: { madrasaId, examRoutineId, ...(preserveManualOverrides ? { isManualOverride: false } : {}) },
      });
      if (plan.length) {
        await tx.seatAllocation.createMany({
          data: plan.map((p) => ({ madrasaId, examRoutineId, strategy: strategy as any, ...p })),
        });
      }
    });

    // Mirror the assigned seat onto ExamCandidate.candidateNo - that
    // field's own doc-comment anticipates exactly this (see exam-
    // operations.prisma's SeatAllocation model comment) - AFTER the real
    // seat-allocation transaction has already committed, and best-effort
    // (never lets a mirror failure roll back or fail the actual seat
    // allocation, which is the authoritative data - SeatAllocation rows,
    // not this cosmetic mirror). Still one bulk UPDATE...FROM (VALUES ...)
    // statement, not a per-candidate loop.
    //
    // Room-qualified ("R1-3" not bare "3"): ExamCandidate.candidateNo is
    // unique per (madrasaId, examId) while SeatAllocation.seatNo is only
    // unique per (examRoutineId, roomId) - seat numbering restarts at 1 in
    // every room, so mirroring the bare seat number crashed this whole
    // endpoint (23505 unique violation) the moment an exam used more than
    // one room. Qualifying with the room's code makes same-call collisions
    // impossible; a residual collision is still possible if two different
    // exam-routine slots (different subjects/days) happen to reuse the
    // same room+seat combo for two different candidates in the SAME exam -
    // a real but narrow pre-existing limitation of mirroring one mutable
    // field across multiple slots, not something this pass redesigns. The
    // WHERE NOT EXISTS guard below skips just that one row instead of
    // failing the whole batch (a plain UPDATE would abort on the first
    // conflicting row and roll back nothing since it now runs outside the
    // seat-allocation transaction, but would still error the request).
    if (plan.length) {
      const values = Prisma.join(
        plan.map((p) => {
          const roomCode = roomCodeById.get(p.roomId) || String(p.roomId);
          return Prisma.sql`(${p.examCandidateId}, ${`${roomCode}-${p.seatNo}`})`;
        }),
      );
      await prisma.$executeRaw`
        UPDATE exam_candidates AS ec
        SET candidate_no = v.candidate_no
        FROM (VALUES ${values}) AS v(candidate_id, candidate_no)
        WHERE ec.id = v.candidate_id
          AND NOT EXISTS (
            SELECT 1 FROM exam_candidates ec2
            WHERE ec2.madrasa_id = ec.madrasa_id
              AND ec2.exam_id = ec.exam_id
              AND ec2.candidate_no = v.candidate_no
              AND ec2.id <> ec.id
          )
      `;
    }
  }

  updateSeat(id: number, madrasaId: number, data: Record<string, unknown>) {
    return prisma.seatAllocation.updateMany({ where: { id, madrasaId }, data });
  }

  /** Same room-qualification and best-effort collision handling as
   * replaceAllocations's bulk mirror above (see its comment) - a bare
   * seatNo here has the identical unique-constraint risk for a manual
   * single-seat adjustment. */
  async setCandidateNo(madrasaId: number, examCandidateId: number, roomCode: string, seatNo: string) {
    const candidateNo = `${roomCode}-${seatNo}`;
    try {
      // examId is resolved from the target row itself (exam_candidates
      // already has it) rather than requiring the caller to pass it.
      await prisma.$executeRaw`
        UPDATE exam_candidates AS ec
        SET candidate_no = ${candidateNo}
        WHERE ec.id = ${examCandidateId}
          AND NOT EXISTS (
            SELECT 1 FROM exam_candidates ec2
            WHERE ec2.madrasa_id = ${madrasaId}
              AND ec2.exam_id = ec.exam_id
              AND ec2.candidate_no = ${candidateNo}
              AND ec2.id <> ec.id
          )
      `;
    } catch (err: any) {
      // Best-effort mirror - the real SeatAllocation row (already updated
      // by updateSeat above) stays authoritative regardless.
      if (err?.code !== "P2010") throw err;
    }
  }

  clearByRoutine(madrasaId: number, examRoutineId: number) {
    return prisma.seatAllocation.deleteMany({ where: { madrasaId, examRoutineId } });
  }
}

export const examSeatRepository = new ExamSeatRepository();
