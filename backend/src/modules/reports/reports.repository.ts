import { prisma } from "../../shared/database/prisma";
import { MISSING_TABLE_OR_COLUMN_CODES, REPORT_MISSING_TABLE_WARNING } from "./reports.constants";
import { OptionalQueryResult } from "./reports.types";

const isMissingTableOrColumn = (error: any) => {
  const code = error?.code || error?.meta?.code;
  return MISSING_TABLE_OR_COLUMN_CODES.includes(code);
};

export class ReportsRepository {
  runQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return prisma.$queryRawUnsafe<T[]>(sql, ...params);
  }

  // Reports build a lot of dynamic SQL (varying columns/joins per report),
  // so rather than force each one into the ORM DSL, we keep the SQL
  // strings but run them through Prisma's connection pool via
  // $queryRawUnsafe, gracefully degrading to an empty result (with a
  // warning) if the underlying table/column doesn't exist yet.
  async runOptionalQuery<T = any>(sql: string, params: any[] = []): Promise<OptionalQueryResult<T>> {
    try {
      const rows = await prisma.$queryRawUnsafe<T[]>(sql, ...params);
      return { rows: Array.isArray(rows) ? rows : [], warning: undefined };
    } catch (error: any) {
      if (isMissingTableOrColumn(error)) {
        return { rows: [], warning: REPORT_MISSING_TABLE_WARNING };
      }
      throw error;
    }
  }

  /* ================= ACADEMIC ================= */

  findAcademicResults(madrasaId: number) {
    return this.runOptionalQuery(
      `
      SELECT
        s.id AS student_id,
        s.division_id,
        s.class_id,
        s.name_bn AS student_name,
        s.father_name,
        s.guardian_phone,
        COALESCE(c.name_bn, c.name) AS class_name,
        COALESCE(d.name_bn, d.name) AS division_name,
        rs.total,
        rs.average,
        rs.general_grade,
        rs.madrasa_grade,
        rs.status,
        rs.rank_no,
        rm.status AS publish_status
      FROM results_summary rs
      INNER JOIN students s ON s.id = rs.student_id
      INNER JOIN results_master rm ON rm.id = rs.result_master_id
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN divisions d ON d.id = s.division_id
      WHERE s.madrasa_id = ?
      ORDER BY rm.id DESC, rs.rank_no ASC, s.id ASC
      `,
      [madrasaId],
    );
  }

  findAcademicRoutines(madrasaId: number) {
    return this.runOptionalQuery(
      `
      SELECT
        r.id,
        r.division_id,
        r.class_id,
        r.day,
        r.start_time,
        r.end_time,
        COALESCE(c.name_bn, c.name) AS class_name,
        COALESCE(d.name_bn, d.name) AS division_name,
        COALESCE(b.name_bn, b.name) AS subject_name,
        t.name_bn AS teacher_name
      FROM routines r
      LEFT JOIN classes c ON c.id = r.class_id
      LEFT JOIN divisions d ON d.id = r.division_id
      LEFT JOIN books b ON b.id = r.book_id
      LEFT JOIN teachers t ON t.id = r.teacher_id
      WHERE r.madrasa_id = ?
      ORDER BY r.day, r.start_time
      `,
      [madrasaId],
    );
  }

  findAcademicAdmissions(madrasaId: number) {
    return this.runQuery(
      `
      SELECT
        s.id,
        s.division_id,
        s.class_id,
        s.name_bn AS student_name,
        s.father_name,
        s.mother_name,
        s.guardian_phone,
        COALESCE(c.name_bn, c.name) AS class_name,
        COALESCE(d.name_bn, d.name) AS division_name,
        s.division,
        s.district,
        s.thana,
        s.village
      FROM students s
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN divisions d ON d.id = s.division_id
      WHERE s.madrasa_id = ?
      ORDER BY s.id DESC
      `,
      [madrasaId],
    );
  }

  findGuardianPhones(madrasaId: number) {
    return this.runQuery(
      `
      SELECT
        s.id,
        s.division_id,
        s.class_id,
        s.name_bn AS student_name,
        s.father_name,
        s.guardian_phone,
        COALESCE(c.name_bn, c.name) AS class_name,
        COALESCE(d.name_bn, d.name) AS division_name
      FROM students s
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN divisions d ON d.id = s.division_id
      WHERE s.madrasa_id = ?
      ORDER BY c.id ASC, s.name_bn ASC
      `,
      [madrasaId],
    );
  }

  findResidentialAttendance(madrasaId: number) {
    return this.runQuery(
      `
      SELECT
        s.id,
        s.division_id,
        s.class_id,
        s.name_bn AS student_name,
        COALESCE(c.name_bn, c.name) AS class_name,
        COALESCE(d.name_bn, d.name) AS division_name
      FROM students s
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN divisions d ON d.id = s.division_id
      WHERE s.madrasa_id = ?
      ORDER BY c.id ASC, s.name_bn ASC
      `,
      [madrasaId],
    );
  }

  /* ================= STUDENT ================= */

  findStudentIdCards(madrasaId: number) {
    return this.runQuery(
      `
      SELECT
        s.id,
        s.division_id,
        s.class_id,
        s.name_bn AS student_name,
        s.father_name,
        s.guardian_phone,
        COALESCE(c.name_bn, c.name) AS class_name,
        COALESCE(d.name_bn, d.name) AS division_name,
        s.image
      FROM students s
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN divisions d ON d.id = s.division_id
      WHERE s.madrasa_id = ?
      ORDER BY s.id DESC
      `,
      [madrasaId],
    );
  }

  findStudentMarksheets(madrasaId: number) {
    return this.runOptionalQuery(
      `
      SELECT
        s.id AS student_id,
        s.division_id,
        s.class_id,
        s.name_bn AS student_name,
        s.father_name,
        s.guardian_phone,
        COALESCE(c.name_bn, c.name) AS class_name,
        COALESCE(d.name_bn, d.name) AS division_name,
        rs.total,
        rs.average,
        rs.general_grade,
        rs.madrasa_grade,
        rs.status,
        rs.rank_no
      FROM results_summary rs
      INNER JOIN students s ON s.id = rs.student_id
      INNER JOIN results_master rm ON rm.id = rs.result_master_id
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN divisions d ON d.id = s.division_id
      WHERE s.madrasa_id = ?
      ORDER BY rm.id DESC, rs.rank_no ASC
      `,
      [madrasaId],
    );
  }

  findStudentCertificates(madrasaId: number) {
    return this.runQuery(
      `
      SELECT
        s.id,
        s.division_id,
        s.class_id,
        s.name_bn AS student_name,
        s.father_name,
        s.mother_name,
        s.guardian_phone,
        COALESCE(c.name_bn, c.name) AS class_name,
        COALESCE(d.name_bn, d.name) AS division_name,
        s.village,
        s.thana,
        s.district
      FROM students s
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN divisions d ON d.id = s.division_id
      WHERE s.madrasa_id = ?
      ORDER BY s.id DESC
      `,
      [madrasaId],
    );
  }

  findStudentAdmitCards(madrasaId: number) {
    return this.runOptionalQuery(
      `
      SELECT
        s.id,
        s.division_id,
        s.class_id,
        s.name_bn AS student_name,
        s.father_name,
        s.roll,
        s.academic_year,
        COALESCE(c.name_bn, c.name) AS class_name,
        COALESCE(d.name_bn, d.name) AS division_name,
        e.name AS exam_name,
        e.year AS exam_year
      FROM students s
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN divisions d ON d.id = s.division_id
      LEFT JOIN exams e ON e.madrasa_id = s.madrasa_id
        AND e.id = (
          SELECT ex2.id FROM exams ex2
          WHERE ex2.madrasa_id = s.madrasa_id
          ORDER BY ex2.id DESC LIMIT 1
        )
      WHERE s.madrasa_id = ?
      ORDER BY s.id DESC
      `,
      [madrasaId],
    );
  }

  findStudentSanads(madrasaId: number) {
    return this.runOptionalQuery(
      `
      SELECT
        s.id,
        s.division_id,
        s.class_id,
        s.name_bn AS student_name,
        s.father_name,
        s.mother_name,
        s.academic_year,
        COALESCE(c.name_bn, c.name) AS class_name,
        COALESCE(d.name_bn, d.name) AS division_name,
        rs.general_grade AS result_summary
      FROM students s
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN divisions d ON d.id = s.division_id
      LEFT JOIN results_summary rs ON rs.id = (
        SELECT rs2.id FROM results_summary rs2
        WHERE rs2.student_id = s.id
        ORDER BY rs2.id DESC LIMIT 1
      )
      WHERE s.madrasa_id = ?
      ORDER BY s.id DESC
      `,
      [madrasaId],
    );
  }

  findStudentTransferLetters(madrasaId: number) {
    return this.runQuery(
      `
      SELECT
        s.id,
        s.division_id,
        s.class_id,
        s.name_bn AS student_name,
        s.father_name,
        s.guardian_phone,
        s.academic_year,
        COALESCE(c.name_bn, c.name) AS class_name,
        COALESCE(d.name_bn, d.name) AS division_name
      FROM students s
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN divisions d ON d.id = s.division_id
      WHERE s.madrasa_id = ?
      ORDER BY s.id DESC
      `,
      [madrasaId],
    );
  }

  /* ================= TEACHER ================= */

  findTeacherList(madrasaId: number) {
    return this.runQuery(
      `
      SELECT
        t.id,
        t.division_id,
        t.name_bn AS teacher_name,
        t.phone,
        t.email,
        t.designation,
        t.department,
        t.qualification,
        COALESCE(d.name_bn, d.name) AS division_name,
        t.joining_date
      FROM teachers t
      LEFT JOIN divisions d ON d.id = t.division_id
      WHERE t.madrasa_id = ?
      ORDER BY t.id DESC
      `,
      [madrasaId],
    );
  }

  findTeacherPhones(madrasaId: number) {
    return this.runQuery(
      `
      SELECT
        t.id,
        t.division_id,
        t.name_bn AS teacher_name,
        t.phone,
        t.parent_phone,
        t.designation,
        COALESCE(d.name_bn, d.name) AS division_name
      FROM teachers t
      LEFT JOIN divisions d ON d.id = t.division_id
      WHERE t.madrasa_id = ?
      ORDER BY t.name_bn ASC
      `,
      [madrasaId],
    );
  }
}

export const reportsRepository = new ReportsRepository();
