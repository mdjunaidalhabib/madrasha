import { prisma } from "../../shared/database/prisma";

export class ExamAttendanceRepository {
  findRoutineForAttendance(id: number, madrasaId: number) {
    return prisma.examRoutine.findFirst({
      where: { id, madrasaId },
      select: { id: true, examId: true, classId: true, divisionId: true, roomId: true },
    });
  }

  /** Registered/eligible candidates for a routine's exam+class(+division) -
   * the roster "mark absent by default" fills in. Plain raw query since
   * ExamCandidate isn't a Prisma relation from this module (see the
   * file-level note in exam-operations.prisma). */
  findEligibleCandidatesForRoutine(madrasaId: number, examId: number, classId: number, divisionId: number | null) {
    return prisma.$queryRaw<{ id: number }[]>`
      SELECT ec.id AS id
      FROM exam_candidates ec
      WHERE ec.madrasa_id = ${madrasaId}
        AND ec.exam_id = ${examId}
        AND ec.class_id = ${classId}
        AND (${divisionId}::int IS NULL OR ec.division_id = ${divisionId})
        AND ec.status IN ('REGISTERED', 'ELIGIBLE')
    `;
  }

  isRoutineLocked(madrasaId: number, examRoutineId: number) {
    return prisma.examAttendance.count({ where: { madrasaId, examRoutineId, isLocked: true } });
  }

  upsertEntry(
    madrasaId: number,
    examRoutineId: number,
    examCandidateId: number,
    roomId: number | null,
    status: string,
    remarks: string | null,
    markedById: number | null,
  ) {
    return prisma.examAttendance.upsert({
      where: { examRoutineId_examCandidateId: { examRoutineId, examCandidateId } },
      create: {
        madrasaId,
        examRoutineId,
        examCandidateId,
        roomId,
        status: status as any,
        remarks,
        markedById,
      },
      update: { status: status as any, remarks, markedById, markedAt: new Date() },
    });
  }

  updateOne(id: number, madrasaId: number, data: Record<string, unknown>) {
    return prisma.examAttendance.updateMany({ where: { id, madrasaId }, data });
  }

  findById(id: number, madrasaId: number) {
    return prisma.examAttendance.findFirst({ where: { id, madrasaId } });
  }

  lockRoutine(madrasaId: number, examRoutineId: number, lockedById: number | null) {
    return prisma.examAttendance.updateMany({
      where: { madrasaId, examRoutineId },
      data: { isLocked: true, lockedById, lockedAt: new Date() },
    });
  }

  unlockRoutine(madrasaId: number, examRoutineId: number) {
    return prisma.examAttendance.updateMany({
      where: { madrasaId, examRoutineId },
      data: { isLocked: false, lockedById: null, lockedAt: null },
    });
  }

  /** Full roster view: every registered/eligible candidate for the
   * routine's exam+class(+division), LEFT JOINed to this routine's
   * ExamAttendance row (if marked yet) - so the marking UI sees the whole
   * class, not just already-marked rows, exactly like a real roll-call
   * sheet. Unmarked candidates come back with attendance_id = null and a
   * default status of PRESENT (display-only default; nothing is persisted
   * until an actual mark/bulk-mark call). */
  findRosterForRoutine(
    madrasaId: number,
    examRoutineId: number,
    examId: number,
    classId: number,
    divisionId: number | null,
    status?: string,
    search?: string,
  ) {
    return prisma.$queryRaw<
      {
        exam_candidate_id: number;
        attendance_id: number | null;
        room_id: number | null;
        status: string;
        remarks: string | null;
        marked_by_id: number | null;
        marked_at: Date | null;
        is_locked: boolean;
        registration_no: string | null;
        candidate_no: string | null;
        student_name_bn: string;
        student_name_en: string | null;
        roll: number | null;
      }[]
    >`
      SELECT ec.id AS exam_candidate_id, ea.id AS attendance_id, ea.room_id,
             COALESCE(ea.status::text, 'PRESENT') AS status, ea.remarks,
             ea.marked_by_id, ea.marked_at, COALESCE(ea.is_locked, false) AS is_locked,
             ec.registration_no, ec.candidate_no,
             s.name_bn AS student_name_bn, s.name_en AS student_name_en, s.roll AS roll
      FROM exam_candidates ec
      JOIN students s ON s.id = ec.student_id
      LEFT JOIN exam_attendances ea ON ea.exam_routine_id = ${examRoutineId} AND ea.exam_candidate_id = ec.id
      WHERE ec.madrasa_id = ${madrasaId}
        AND ec.exam_id = ${examId}
        AND ec.class_id = ${classId}
        AND (${divisionId}::int IS NULL OR ec.division_id = ${divisionId})
        AND ec.status IN ('REGISTERED', 'ELIGIBLE')
        AND (${status}::text IS NULL OR COALESCE(ea.status::text, 'PRESENT') = ${status})
        AND (
          ${search}::text IS NULL
          OR s.name_bn ILIKE '%' || ${search} || '%'
          OR s.name_en ILIKE '%' || ${search} || '%'
          OR CAST(s.roll AS TEXT) = ${search}
        )
      ORDER BY s.roll ASC NULLS LAST
    `;
  }
}

export const examAttendanceRepository = new ExamAttendanceRepository();
