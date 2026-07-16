import { prisma } from "../../shared/database/prisma";
import { MarksheetSubjectRow } from "./talimat.types";

// NOTE: `results` / `subjects` tables aren't in schema.prisma - they don't
// exist in schema new.sql either (looks like legacy/dead code superseded by
// the results_master + marks + books tables used by ResultPanel). Kept as
// raw queries so behavior is unchanged; flag this to remove or wire up
// properly once confirmed unused.
export class TalimatRepository {
  insertResult(madrasaId: number, studentId: number, subjectId: number, marks: number) {
    return prisma.$executeRaw`
      INSERT INTO results (madrasa_id, student_id, subject_id, marks)
      VALUES (${madrasaId}, ${studentId}, ${subjectId}, ${marks})
    `;
  }

  findMarksheetRows(madrasaId: number, studentId: number) {
    return prisma.$queryRaw<MarksheetSubjectRow[]>`
      SELECT s.name_bn as subject, r.marks
      FROM results r
      JOIN subjects s ON s.id = r.subject_id
      WHERE r.student_id = ${studentId} AND r.madrasa_id = ${madrasaId}
    `;
  }
}

export const talimatRepository = new TalimatRepository();
