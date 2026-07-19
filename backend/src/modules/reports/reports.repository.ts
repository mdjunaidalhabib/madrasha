import { prisma } from "../../shared/database/prisma";
import { MISSING_TABLE_OR_COLUMN_CODES, REPORT_MISSING_TABLE_WARNING } from "./reports.constants";
import { OptionalQueryResult } from "./reports.types";

const isMissingTableOrColumn = (error: any) => {
  const codes = [error?.code, error?.meta?.code, error?.meta?.dbCode].filter(Boolean);
  return codes.some((code) => MISSING_TABLE_OR_COLUMN_CODES.includes(String(code)));
};

const RESULT_FALLBACK_WARNING =
  "এখনো ফলাফল প্রকাশ করা হয়নি। শিক্ষার্থী তালিকা দেখানো হচ্ছে; ফলাফল এন্ট্রি ও প্রকাশ হলে পূর্ণ রিপোর্ট দেখা যাবে।";
const ROUTINE_FALLBACK_WARNING =
  "ক্লাস রুটিন এখনো সংরক্ষণ করা হয়নি। শিক্ষক-কিতাব বণ্টনের তথ্য দিয়ে প্রাথমিক তালিকা দেখানো হচ্ছে।";
const ATTENDANCE_FALLBACK_WARNING =
  "হাজিরার রেকর্ড এখনো সংরক্ষণ করা হয়নি। বর্তমান শিক্ষার্থী তালিকা দিয়ে প্রিন্টযোগ্য হাজিরা খাতা তৈরি করা হয়েছে।";

export class ReportsRepository {
  runQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return prisma.$queryRawUnsafe<T[]>(sql, ...params);
  }

  async runOptionalQuery<T = any>(
    sql: string,
    params: any[] = [],
  ): Promise<OptionalQueryResult<T>> {
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

  private findActiveStudentRoster(madrasaId: number) {
    return this.runQuery(
      `
      SELECT
        s.id,
        s.registration_no,
        s.id AS student_id,
        s.roll,
        s.division_id,
        s.class_id,
        s.academic_year,
        s.name_bn AS student_name,
        s.father_name,
        s.mother_name,
        s.guardian_phone,
        s.image,
        COALESCE(c.name_bn, c.name) AS class_name,
        COALESCE(d.name_bn, d.name) AS division_name
      FROM students s
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN divisions d ON d.id = s.division_id
      WHERE s.madrasa_id = $1
        AND s.deleted_at IS NULL
        AND s.is_active = 1
      ORDER BY d.id ASC, c.id ASC, s.roll ASC NULLS LAST, s.name_bn ASC
      `,
      [madrasaId],
    );
  }

  private async resultRosterFallback(madrasaId: number): Promise<OptionalQueryResult<any>> {
    const roster = await this.findActiveStudentRoster(madrasaId);
    return {
      rows: roster.map((row: any) => ({
        ...row,
        exam_name: "—",
        exam_year: row.academic_year || "—",
        total: null,
        average: null,
        general_grade: null,
        madrasa_grade: null,
        rank_no: null,
        status: "ফলাফল প্রকাশ হয়নি",
        publish_status: "DRAFT",
      })),
      warning: RESULT_FALLBACK_WARNING,
    };
  }

  /* ================= ACADEMIC ================= */

  async findAcademicResults(madrasaId: number): Promise<OptionalQueryResult<any>> {
    const result = await this.runOptionalQuery(
      `
      SELECT
        s.id,
        s.registration_no,
        s.id AS student_id,
        COALESCE(rs.roll, s.roll) AS roll,
        s.division_id,
        s.class_id,
        s.academic_year,
        s.name_bn AS student_name,
        s.father_name,
        s.guardian_phone,
        COALESCE(c.name_bn, c.name) AS class_name,
        COALESCE(d.name_bn, d.name) AS division_name,
        e.name AS exam_name,
        e.year AS exam_year,
        rs.total,
        rs.average,
        rs.general_grade,
        rs.madrasa_grade,
        rs.status,
        rs.rank_no,
        rm.status AS publish_status,
        rm.id AS result_master_id
      FROM results_summary rs
      INNER JOIN students s ON s.id = rs.student_id
      INNER JOIN results_master rm ON rm.id = rs.result_master_id
      LEFT JOIN exams e ON e.id = rm.exam_id
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN divisions d ON d.id = s.division_id
      WHERE s.madrasa_id = $1
        AND s.deleted_at IS NULL
        AND s.is_active = 1
      ORDER BY rm.id DESC, rs.rank_no ASC NULLS LAST, COALESCE(rs.roll, s.roll) ASC NULLS LAST, s.id ASC
      `,
      [madrasaId],
    );

    if (result.rows.length) return result;
    return this.resultRosterFallback(madrasaId);
  }

  async findAcademicResultNotice(madrasaId: number): Promise<OptionalQueryResult<any>> {
    const result = await this.runOptionalQuery(
      `
      SELECT
        s.id,
        s.registration_no,
        s.id AS student_id,
        COALESCE(rs.roll, s.roll) AS roll,
        s.division_id,
        s.class_id,
        s.academic_year,
        s.name_bn AS student_name,
        COALESCE(c.name_bn, c.name) AS class_name,
        COALESCE(d.name_bn, d.name) AS division_name,
        e.name AS exam_name,
        e.year AS exam_year,
        rs.total,
        rs.average,
        rs.general_grade,
        rs.madrasa_grade,
        rs.status,
        rs.rank_no,
        rm.status AS publish_status,
        rm.id AS result_master_id
      FROM results_summary rs
      INNER JOIN students s ON s.id = rs.student_id
      INNER JOIN results_master rm ON rm.id = rs.result_master_id
      LEFT JOIN exams e ON e.id = rm.exam_id
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN divisions d ON d.id = s.division_id
      WHERE s.madrasa_id = $1
        AND s.deleted_at IS NULL
        AND s.is_active = 1
        AND rm.status = 'PUBLISHED'
      ORDER BY rm.id DESC, rs.rank_no ASC NULLS LAST, COALESCE(rs.roll, s.roll) ASC NULLS LAST
      `,
      [madrasaId],
    );

    if (result.rows.length) return result;
    return this.resultRosterFallback(madrasaId);
  }

  async findAcademicRoutines(madrasaId: number): Promise<OptionalQueryResult<any>> {
    const routineResult = await this.runOptionalQuery(
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
      WHERE r.madrasa_id = $1
      ORDER BY r.day, r.start_time
      `,
      [madrasaId],
    );

    if (routineResult.rows.length) return routineResult;

    const assignmentRows = await this.runQuery(
      `
      SELECT
        ta.id,
        t.division_id,
        ta.class_id,
        'নির্ধারিত নয়'::text AS day,
        '—'::text AS start_time,
        '—'::text AS end_time,
        COALESCE(c.name_bn, c.name) AS class_name,
        COALESCE(d.name_bn, d.name) AS division_name,
        COALESCE(b.name_bn, b.name) AS subject_name,
        t.name_bn AS teacher_name
      FROM teacher_assignments ta
      INNER JOIN teachers t ON t.id = ta.teacher_id
      LEFT JOIN classes c ON c.id = ta.class_id
      LEFT JOIN divisions d ON d.id = t.division_id
      LEFT JOIN books b ON b.id = ta.book_id
      WHERE ta.madrasa_id = $1
        AND t.deleted_at IS NULL
        AND COALESCE(t.is_active, 1) = 1
      ORDER BY d.id ASC, c.id ASC, b.id ASC, t.name_bn ASC
      `,
      [madrasaId],
    );

    return {
      rows: Array.isArray(assignmentRows) ? assignmentRows : [],
      warning: ROUTINE_FALLBACK_WARNING,
    };
  }

  findAcademicAdmissions(madrasaId: number) {
    return this.runQuery(
      `
      SELECT
        s.id,
        s.registration_no,
        s.roll,
        s.division_id,
        s.class_id,
        s.academic_year,
        s.admission_date,
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
      WHERE s.madrasa_id = $1
        AND s.deleted_at IS NULL
        AND s.is_active = 1
      ORDER BY s.admission_date DESC NULLS LAST, s.id DESC
      `,
      [madrasaId],
    );
  }

  findGuardianPhones(madrasaId: number) {
    return this.runQuery(
      `
      SELECT
        s.id,
        s.registration_no,
        s.roll,
        s.division_id,
        s.class_id,
        s.academic_year,
        s.name_bn AS student_name,
        s.father_name,
        s.guardian_phone,
        COALESCE(c.name_bn, c.name) AS class_name,
        COALESCE(d.name_bn, d.name) AS division_name
      FROM students s
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN divisions d ON d.id = s.division_id
      WHERE s.madrasa_id = $1
        AND s.deleted_at IS NULL
        AND s.is_active = 1
      ORDER BY d.id ASC, c.id ASC, s.roll ASC NULLS LAST, s.name_bn ASC
      `,
      [madrasaId],
    );
  }

  findExamSignatureSheet(madrasaId: number, examId?: number) {
    return this.runQuery(
      `
      WITH selected_exam AS (
        SELECT e.id, e.name, e.year
        FROM exams e
        WHERE e.madrasa_id = $1
          AND e.deleted_at IS NULL
          AND ($2::int IS NULL OR e.id = $2::int)
        ORDER BY CASE WHEN e.id = $2::int THEN 0 ELSE 1 END, e.id DESC
        LIMIT 1
      )
      SELECT
        s.id,
        s.id AS student_id,
        s.registration_no,
        s.roll,
        s.division_id,
        s.class_id,
        s.academic_year,
        s.name_bn AS student_name,
        s.father_name,
        COALESCE(c.name_bn, c.name) AS class_name,
        COALESCE(d.name_bn, d.name) AS division_name,
        e.id AS exam_id,
        e.name AS exam_name,
        e.year AS exam_year
      FROM students s
      CROSS JOIN selected_exam e
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN divisions d ON d.id = s.division_id
      WHERE s.madrasa_id = $1
        AND s.deleted_at IS NULL
        AND s.is_active = 1
      ORDER BY d.id ASC, c.id ASC, s.roll ASC NULLS LAST, s.name_bn ASC
      `,
      [madrasaId, examId || null],
    );
  }

  findExamNumberSheet(madrasaId: number, examId?: number) {
    return this.runQuery(
      `
      WITH selected_exam AS (
        SELECT e.id, e.name, e.year
        FROM exams e
        WHERE e.madrasa_id = $1
          AND e.deleted_at IS NULL
          AND ($2::int IS NULL OR e.id = $2::int)
        ORDER BY CASE WHEN e.id = $2::int THEN 0 ELSE 1 END, e.id DESC
        LIMIT 1
      )
      SELECT
        s.id,
        s.id AS student_id,
        s.registration_no,
        COALESCE(rs.roll, s.roll) AS roll,
        s.division_id,
        s.class_id,
        s.academic_year,
        s.name_bn AS student_name,
        s.father_name,
        COALESCE(c.name_bn, c.name) AS class_name,
        COALESCE(d.name_bn, d.name) AS division_name,
        e.id AS exam_id,
        e.name AS exam_name,
        e.year AS exam_year,
        rs.total,
        rs.average,
        rs.general_grade,
        rs.madrasa_grade,
        rs.status,
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'book_id', b.id,
              'subject_name', COALESCE(b.name_bn, b.name),
              'mark', m.mark
            )
            ORDER BY b.id
          ) FILTER (WHERE b.id IS NOT NULL),
          '[]'::jsonb
        ) AS subjects
      FROM students s
      CROSS JOIN selected_exam e
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN divisions d ON d.id = s.division_id
      LEFT JOIN madrasa_books mb
        ON mb.madrasa_id = s.madrasa_id
        AND COALESCE(mb.is_active, 1) = 1
      LEFT JOIN books b
        ON b.id = mb.book_id
        AND b.class_id = s.class_id
      LEFT JOIN results_master rm
        ON rm.madrasa_id = s.madrasa_id
        AND rm.exam_id = e.id
        AND rm.class_id = s.class_id
      LEFT JOIN results_summary rs
        ON rs.result_master_id = rm.id
        AND rs.student_id = s.id
      LEFT JOIN marks m
        ON m.result_master_id = rm.id
        AND m.student_id = s.id
        AND m.book_id = b.id
      WHERE s.madrasa_id = $1
        AND s.deleted_at IS NULL
        AND s.is_active = 1
      GROUP BY
        s.id,
        s.registration_no,
        s.roll,
        s.division_id,
        s.class_id,
        s.academic_year,
        s.name_bn,
        s.father_name,
        c.name_bn,
        c.name,
        d.name_bn,
        d.name,
        e.id,
        e.name,
        e.year,
        rs.roll,
        rs.total,
        rs.average,
        rs.general_grade,
        rs.madrasa_grade,
        rs.status
      ORDER BY s.division_id ASC, s.class_id ASC, COALESCE(rs.roll, s.roll) ASC NULLS LAST, s.name_bn ASC
      `,
      [madrasaId, examId || null],
    );
  }

  findResidentialAttendance(madrasaId: number) {
    return this.findActiveStudentRoster(madrasaId);
  }

  async findDailyAttendance(madrasaId: number): Promise<OptionalQueryResult<any>> {
    const attendance = await this.runOptionalQuery(
      `
      SELECT
        a.id,
        a.student_id,
        s.roll,
        s.division_id,
        s.class_id,
        s.name_bn AS student_name,
        COALESCE(c.name_bn, c.name) AS class_name,
        COALESCE(d.name_bn, d.name) AS division_name,
        a.attendance_date AS date,
        a.status
      FROM student_attendance a
      INNER JOIN students s ON s.id = a.student_id
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN divisions d ON d.id = s.division_id
      WHERE a.madrasa_id = $1
        AND s.deleted_at IS NULL
        AND s.is_active = 1
      ORDER BY a.attendance_date DESC, d.id ASC, c.id ASC, s.roll ASC NULLS LAST
      `,
      [madrasaId],
    );

    if (attendance.rows.length) return attendance;
    const roster = await this.findActiveStudentRoster(madrasaId);
    return { rows: roster, warning: ATTENDANCE_FALLBACK_WARNING };
  }

  async findDigitalAttendance(madrasaId: number): Promise<OptionalQueryResult<any>> {
    const attendance = await this.runOptionalQuery(
      `
      SELECT
        a.id,
        a.student_id,
        s.roll,
        s.division_id,
        s.class_id,
        s.name_bn AS student_name,
        COALESCE(c.name_bn, c.name) AS class_name,
        COALESCE(d.name_bn, d.name) AS division_name,
        a.attendance_date AS date,
        a.check_in,
        a.check_out,
        a.status
      FROM student_attendance a
      INNER JOIN students s ON s.id = a.student_id
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN divisions d ON d.id = s.division_id
      WHERE a.madrasa_id = $1
        AND s.deleted_at IS NULL
        AND s.is_active = 1
      ORDER BY a.attendance_date DESC, a.check_in ASC NULLS LAST, s.roll ASC NULLS LAST
      `,
      [madrasaId],
    );

    if (attendance.rows.length) return attendance;
    const roster = await this.findActiveStudentRoster(madrasaId);
    return {
      rows: roster.map((row: any) => ({
        ...row,
        date: null,
        check_in: null,
        check_out: null,
        status: null,
      })),
      warning: ATTENDANCE_FALLBACK_WARNING,
    };
  }

  /* ================= STUDENT ================= */

  findStudentIdCards(madrasaId: number) {
    return this.findActiveStudentRoster(madrasaId);
  }

  async findStudentMarksheets(madrasaId: number): Promise<OptionalQueryResult<any>> {
    const result = await this.runOptionalQuery(
      `
      SELECT
        s.id,
        s.registration_no,
        s.id AS student_id,
        COALESCE(rs.roll, s.roll) AS roll,
        s.division_id,
        s.class_id,
        s.academic_year,
        s.name_bn AS student_name,
        s.father_name,
        s.guardian_phone,
        COALESCE(c.name_bn, c.name) AS class_name,
        COALESCE(d.name_bn, d.name) AS division_name,
        e.name AS exam_name,
        e.year AS exam_year,
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
      LEFT JOIN exams e ON e.id = rm.exam_id
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN divisions d ON d.id = s.division_id
      WHERE s.madrasa_id = $1
        AND s.deleted_at IS NULL
        AND s.is_active = 1
      ORDER BY rm.id DESC, rs.rank_no ASC NULLS LAST, COALESCE(rs.roll, s.roll) ASC NULLS LAST
      `,
      [madrasaId],
    );

    if (result.rows.length) return result;
    return this.resultRosterFallback(madrasaId);
  }

  findStudentCertificates(madrasaId: number) {
    return this.runQuery(
      `
      SELECT
        s.id,
        s.registration_no,
        s.roll,
        s.division_id,
        s.class_id,
        s.academic_year,
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
      WHERE s.madrasa_id = $1
        AND s.deleted_at IS NULL
        AND s.is_active = 1
      ORDER BY s.roll ASC NULLS LAST, s.id DESC
      `,
      [madrasaId],
    );
  }

  findStudentAdmitCards(madrasaId: number) {
    return this.runOptionalQuery(
      `
      SELECT
        s.id,
        s.registration_no,
        s.roll,
        s.division_id,
        s.class_id,
        s.name_bn AS student_name,
        s.father_name,
        s.academic_year,
        s.image,
        COALESCE(c.name_bn, c.name) AS class_name,
        COALESCE(d.name_bn, d.name) AS division_name,
        e.name AS exam_name,
        e.year AS exam_year
      FROM students s
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN divisions d ON d.id = s.division_id
      LEFT JOIN exams e ON e.madrasa_id = s.madrasa_id
        AND e.id = (
          SELECT ex2.id
          FROM exams ex2
          WHERE ex2.madrasa_id = s.madrasa_id
            AND ex2.deleted_at IS NULL
          ORDER BY ex2.id DESC
          LIMIT 1
        )
      WHERE s.madrasa_id = $1
        AND s.deleted_at IS NULL
        AND s.is_active = 1
      ORDER BY s.roll ASC NULLS LAST, s.id DESC
      `,
      [madrasaId],
    );
  }

  findStudentSanads(madrasaId: number) {
    return this.runOptionalQuery(
      `
      SELECT
        s.id,
        s.registration_no,
        s.roll,
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
        SELECT rs2.id
        FROM results_summary rs2
        WHERE rs2.student_id = s.id
        ORDER BY rs2.id DESC
        LIMIT 1
      )
      WHERE s.madrasa_id = $1
        AND s.deleted_at IS NULL
        AND s.is_active = 1
      ORDER BY s.roll ASC NULLS LAST, s.id DESC
      `,
      [madrasaId],
    );
  }

  findStudentTransferLetters(madrasaId: number) {
    return this.runQuery(
      `
      SELECT
        s.id,
        s.registration_no,
        s.roll,
        s.division_id,
        s.class_id,
        s.name_bn AS student_name,
        s.father_name,
        s.mother_name,
        s.guardian_phone,
        s.academic_year,
        s.village,
        s.thana,
        s.district,
        COALESCE(c.name_bn, c.name) AS class_name,
        COALESCE(d.name_bn, d.name) AS division_name
      FROM students s
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN divisions d ON d.id = s.division_id
      WHERE s.madrasa_id = $1
        AND s.deleted_at IS NULL
        AND s.is_active = 1
      ORDER BY s.roll ASC NULLS LAST, s.id DESC
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
        t.registration_no,
        t.division_id,
        t.name_bn AS teacher_name,
        t.phone,
        t.email,
        t.designation,
        t.department,
        t.qualification,
        t.experience_year,
        t.experience_month,
        COALESCE(d.name_bn, d.name) AS division_name,
        t.joining_date
      FROM teachers t
      LEFT JOIN divisions d ON d.id = t.division_id
      WHERE t.madrasa_id = $1
        AND t.deleted_at IS NULL
        AND COALESCE(t.is_active, 1) = 1
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
        t.registration_no,
        t.division_id,
        t.name_bn AS teacher_name,
        t.phone,
        t.parent_phone,
        t.designation,
        COALESCE(d.name_bn, d.name) AS division_name
      FROM teachers t
      LEFT JOIN divisions d ON d.id = t.division_id
      WHERE t.madrasa_id = $1
        AND t.deleted_at IS NULL
        AND COALESCE(t.is_active, 1) = 1
      ORDER BY t.name_bn ASC
      `,
      [madrasaId],
    );
  }
}

export const reportsRepository = new ReportsRepository();
