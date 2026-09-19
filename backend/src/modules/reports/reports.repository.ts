import { prisma } from "../../shared/database/prisma";
import { MISSING_TABLE_OR_COLUMN_CODES, REPORT_MISSING_TABLE_WARNING } from "./reports.constants";
import { OptionalQueryResult } from "./reports.types";
import { examCandidateParticipationSql } from "../exam-candidate/exam-candidate.policy";

/** Optional narrowing filters accepted by roster-shaped queries (id cards,
 * admit cards) so document-templates.service.ts can generate for a single
 * class or a hand-picked set of students instead of always the whole
 * active roster. All fields optional and backward compatible - existing
 * callers that pass nothing behave exactly as before. */
export interface RosterFilters {
  classId?: number;
  divisionId?: number;
  studentIds?: number[];
}

/** Optional narrowing + pagination filters accepted by academicResultsQuery
 * (findAcademicResults / findAcademicResultsByRank) - all optional and
 * backward compatible. Without exam/class/division, behaves like before;
 * limit/offset let the controller page through a large result set instead
 * of always shipping every published exam's rows for every student. */
export interface AcademicResultFilters {
  examId?: number;
  classId?: number;
  divisionId?: number;
  limit?: number;
  offset?: number;
}

/** Narrowing filters for the result-notice report (all optional - a request
 * with none of them behaves exactly like the old unfiltered query). */
export interface ResultNoticeFilters {
  examId?: number;
  classId?: number;
  divisionId?: number;
}

/** Narrowing filters for the class-routine report. Routines have no exam
 * concept (see the `routines` table) - only class/division apply. */
export interface RoutineFilters {
  classId?: number;
  divisionId?: number;
}

/** Narrowing filters shared by the exam-routine / room-wise-routine reports
 * (exam_routines table) - examId is threaded separately (same convention as
 * findExamSignatureSheet/findExamNumberSheet below), class/division narrow
 * further exactly like every other roster-shaped report. */
export interface ExamRoutineFilters {
  classId?: number;
  divisionId?: number;
}

/** Narrowing filters for the absent-candidate report (marks table,
 * is_absent = true). */
export interface AbsentCandidateFilters {
  classId?: number;
  divisionId?: number;
}

/** Narrowing filters for the pass/fail result-status lists - reuses the
 * exact same shape as AcademicResultFilters minus pagination (these lists
 * are small enough per exam+class to never need it). */
export interface ResultStatusFilters {
  examId?: number;
  classId?: number;
  divisionId?: number;
}

/** Narrowing filters for the subject-wise performance report (marks table,
 * grouped by book). */
export interface SubjectPerformanceFilters {
  examId?: number;
  classId?: number;
  divisionId?: number;
}

/** Narrowing filters for the exam-summary report (results_master/summary,
 * grouped by class within one exam). */
export interface ExamSummaryFilters {
  examId?: number;
  classId?: number;
  divisionId?: number;
}

/** Narrowing filters for the seat-plan report (exam_seat_allocations). */
export interface SeatPlanFilters {
  roomId?: number;
  classId?: number;
  divisionId?: number;
}

/** Narrowing filters for the invigilator-list report
 * (exam_invigilator_assignments). */
export interface InvigilatorListFilters {
  roomId?: number;
}

/** Narrowing filters for the exam-day attendance sheet (exam_attendances) -
 * deliberately a separate report/filter shape from AbsentCandidateFilters
 * (marks.is_absent), which answers a different question ("who has no marks
 * recorded for a subject") than this one ("who was physically present at
 * the exam hall roll-call"). */
export interface ExamAttendanceSheetFilters {
  roomId?: number;
  classId?: number;
  divisionId?: number;
}

/** Builds the extra `AND ...` SQL fragment + positional params (starting
 * after $1 = madrasaId) for RosterFilters, shared by every roster query
 * that accepts them. */
function buildRosterFilterSql(madrasaId: number, filters: RosterFilters, alias = "s") {
  const params: any[] = [madrasaId];
  const clauses: string[] = [];

  if (filters.classId !== undefined) {
    params.push(filters.classId);
    clauses.push(`AND ${alias}.class_id = $${params.length}`);
  }
  if (filters.divisionId !== undefined) {
    params.push(filters.divisionId);
    clauses.push(`AND ${alias}.division_id = $${params.length}`);
  }
  if (filters.studentIds !== undefined && filters.studentIds.length > 0) {
    params.push(filters.studentIds);
    clauses.push(`AND ${alias}.id = ANY($${params.length}::int[])`);
  }

  return { conditions: clauses.join("\n        "), params };
}

const isMissingTableOrColumn = (error: any) => {
  const codes = [error?.code, error?.meta?.code, error?.meta?.dbCode].filter(Boolean);
  return codes.some((code) => MISSING_TABLE_OR_COLUMN_CODES.includes(String(code)));
};

const RESULT_FALLBACK_WARNING =
  "এখনো ফলাফল প্রকাশ করা হয়নি। শিক্ষার্থী তালিকা দেখানো হচ্ছে; ফলাফল এন্ট্রি ও প্রকাশ হলে পূর্ণ রিপোর্ট দেখা যাবে।";
const ROUTINE_FALLBACK_WARNING =
  "ক্লাস রুটিন এখনো সংরক্ষণ করা হয়নি। শিক্ষক-কিতাব বণ্টনের তথ্য দিয়ে প্রাথমিক তালিকা দেখানো হচ্ছে।";
const ADMIT_CARD_FALLBACK_WARNING =
  "এই পরীক্ষার জন্য কোনো নিবন্ধিত প্রার্থী পাওয়া যায়নি। বর্তমান শিক্ষার্থী তালিকা দিয়ে অ্যাডমিট কার্ড তৈরি করা হয়েছে - আসন/কক্ষের তথ্য দেখাবে না।";
const EXAM_CANDIDATE_LIST_FALLBACK_WARNING =
  "এই পরীক্ষার জন্য কোনো নিবন্ধিত প্রার্থী পাওয়া যায়নি (এক্সাম ক্যান্ডিডেট নিবন্ধন ব্যবহার করা হয়নি)। বর্তমান শিক্ষার্থী তালিকা দেখানো হচ্ছে।";
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

  private findActiveStudentRoster(madrasaId: number, filters: RosterFilters = {}) {
    const { conditions, params } = buildRosterFilterSql(madrasaId, filters);
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
        s.dob AS date_of_birth,
        s.image,
        COALESCE(c.name_bn, c.name) AS class_name,
        COALESCE(d.name_bn, d.name) AS division_name
      FROM students s
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN divisions d ON d.id = s.division_id
      WHERE s.madrasa_id = $1
        AND s.deleted_at IS NULL
        AND s.is_active = 1
        ${conditions}
      ORDER BY d.id ASC, c.id ASC, s.roll ASC NULLS LAST, s.name_bn ASC
      `,
      params,
    );
  }

  private async resultRosterFallback(
    madrasaId: number,
    filters: RosterFilters = {},
  ): Promise<OptionalQueryResult<any>> {
    const roster = await this.findActiveStudentRoster(madrasaId, filters);
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
        subjects: [],
      })),
      warning: RESULT_FALLBACK_WARNING,
    };
  }

  /* ================= ACADEMIC ================= */

  findAcademicResults(
    madrasaId: number,
    filters: AcademicResultFilters = {},
  ): Promise<OptionalQueryResult<any>> {
    return this.academicResultsQuery(
      madrasaId,
      "ORDER BY rm.id DESC, COALESCE(rs.roll, s.roll) ASC NULLS LAST, s.id ASC",
      filters,
    );
  }

  /** Same document as findAcademicResults, but ordered by merit rank (১ম, ২য়, ...)
   * instead of roll number - used by the separate "মেধাক্রম অনুযায়ী ফলাফল" report.
   * rank_no is precomputed and stored on results_summary at publish time, so
   * paginating (limit/offset below) never affects which rank a row shows. */
  findAcademicResultsByRank(
    madrasaId: number,
    filters: AcademicResultFilters = {},
  ): Promise<OptionalQueryResult<any>> {
    return this.academicResultsQuery(
      madrasaId,
      "ORDER BY rm.id DESC, rs.rank_no ASC NULLS LAST, COALESCE(rs.roll, s.roll) ASC NULLS LAST, s.id ASC",
      filters,
    );
  }

  private async academicResultsQuery(
    madrasaId: number,
    orderByClause: string,
    filters: AcademicResultFilters = {},
  ): Promise<OptionalQueryResult<any>> {
    const params: any[] = [madrasaId];
    const conditions: string[] = [];

    if (filters.examId !== undefined) {
      params.push(filters.examId);
      conditions.push(`AND rm.exam_id = $${params.length}`);
    }
    if (filters.classId !== undefined) {
      params.push(filters.classId);
      conditions.push(`AND s.class_id = $${params.length}`);
    }
    if (filters.divisionId !== undefined) {
      params.push(filters.divisionId);
      conditions.push(`AND s.division_id = $${params.length}`);
    }

    let limitOffsetSql = "";
    if (filters.limit !== undefined) {
      params.push(filters.limit);
      limitOffsetSql += ` LIMIT $${params.length}`;
    }
    if (filters.offset !== undefined) {
      params.push(filters.offset);
      limitOffsetSql += ` OFFSET $${params.length}`;
    }

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
        rm.id AS result_master_id,
        COUNT(*) OVER()::int AS total_count,
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'book_id', b.id,
              'subject_name', COALESCE(b.name_bn, b.name),
              'is_miyari', COALESCE(mb.is_miyari, false),
              'full_marks', COALESCE(mb.full_mark, 100),
              'mark', m.mark,
              'is_absent', COALESCE(m.is_absent, false)
            )
            ORDER BY b.id
          ) FILTER (WHERE b.id IS NOT NULL),
          '[]'::jsonb
        ) AS subjects
      FROM results_summary rs
      INNER JOIN students s ON s.id = rs.student_id
      INNER JOIN results_master rm ON rm.id = rs.result_master_id
      LEFT JOIN exams e ON e.id = rm.exam_id
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN divisions d ON d.id = s.division_id
      LEFT JOIN madrasa_books mb
        ON mb.madrasa_id = s.madrasa_id
        AND COALESCE(mb.is_active, 1) = 1
      LEFT JOIN books b
        ON b.id = mb.book_id
        AND b.class_id = s.class_id
      LEFT JOIN marks m
        ON m.result_master_id = rm.id
        AND m.student_id = s.id
        AND m.book_id = b.id
      WHERE s.madrasa_id = $1
        AND s.deleted_at IS NULL
        AND s.is_active = 1
        AND rm.status = 'PUBLISHED'
        ${conditions.join("\n        ")}
      GROUP BY
        s.id,
        s.registration_no,
        s.roll,
        s.division_id,
        s.class_id,
        s.academic_year,
        s.name_bn,
        s.father_name,
        s.guardian_phone,
        c.name_bn,
        c.name,
        d.name_bn,
        d.name,
        e.name,
        e.year,
        rs.roll,
        rs.total,
        rs.average,
        rs.general_grade,
        rs.madrasa_grade,
        rs.status,
        rs.rank_no,
        rm.status,
        rm.id
      ${orderByClause}
      ${limitOffsetSql}
      `,
      params,
    );

    if (result.rows.length) return result;
    return this.resultRosterFallback(madrasaId, {
      classId: filters.classId,
      divisionId: filters.divisionId,
    });
  }

  async findAcademicResultNotice(
    madrasaId: number,
    filters: ResultNoticeFilters = {},
  ): Promise<OptionalQueryResult<any>> {
    const params: any[] = [madrasaId];
    const conditions: string[] = [];

    if (filters.examId !== undefined) {
      params.push(filters.examId);
      conditions.push(`AND rm.exam_id = $${params.length}`);
    }
    if (filters.classId !== undefined) {
      params.push(filters.classId);
      conditions.push(`AND s.class_id = $${params.length}`);
    }
    if (filters.divisionId !== undefined) {
      params.push(filters.divisionId);
      conditions.push(`AND s.division_id = $${params.length}`);
    }

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
        ${conditions.join("\n        ")}
      ORDER BY rm.id DESC, rs.rank_no ASC NULLS LAST, COALESCE(rs.roll, s.roll) ASC NULLS LAST
      `,
      params,
    );

    if (result.rows.length) return result;
    return this.resultRosterFallback(madrasaId, {
      classId: filters.classId,
      divisionId: filters.divisionId,
    });
  }

  async findAcademicRoutines(
    madrasaId: number,
    filters: RoutineFilters = {},
  ): Promise<OptionalQueryResult<any>> {
    const routineParams: any[] = [madrasaId];
    const routineConditions: string[] = [];
    if (filters.classId !== undefined) {
      routineParams.push(filters.classId);
      routineConditions.push(`AND cr.class_id = $${routineParams.length}`);
    }
    if (filters.divisionId !== undefined) {
      routineParams.push(filters.divisionId);
      routineConditions.push(`AND c.division_id = $${routineParams.length}`);
    }

    // Reads from class_routines (see prisma/models/routine.prisma's
    // ClassRoutine) - the actual weekly-schedule table entered via the
    // "রুটিন সেটিংস" page. division_id isn't stored on the routine row
    // itself (only class_id is), so it's read off the joined class instead,
    // matching how the class's own division is looked up everywhere else.
    const routineResult = await this.runOptionalQuery(
      `
      SELECT
        cr.id,
        c.division_id,
        cr.class_id,
        CASE cr.day_of_week
          WHEN 0 THEN 'রবিবার'
          WHEN 1 THEN 'সোমবার'
          WHEN 2 THEN 'মঙ্গলবার'
          WHEN 3 THEN 'বুধবার'
          WHEN 4 THEN 'বৃহস্পতিবার'
          WHEN 5 THEN 'শুক্রবার'
          WHEN 6 THEN 'শনিবার'
        END AS day,
        cr.start_time,
        cr.end_time,
        COALESCE(c.name_bn, c.name) AS class_name,
        COALESCE(d.name_bn, d.name) AS division_name,
        cr.subject AS subject_name,
        t.name_bn AS teacher_name
      FROM class_routines cr
      INNER JOIN classes c ON c.id = cr.class_id
      LEFT JOIN divisions d ON d.id = c.division_id
      LEFT JOIN teachers t ON t.id = cr.teacher_id
      WHERE cr.madrasa_id = $1
        AND cr.is_active = true
        ${routineConditions.join("\n        ")}
      ORDER BY cr.day_of_week, cr.start_time
      `,
      routineParams,
    );

    if (routineResult.rows.length) return routineResult;

    const assignmentParams: any[] = [madrasaId];
    const assignmentConditions: string[] = [];
    if (filters.classId !== undefined) {
      assignmentParams.push(filters.classId);
      assignmentConditions.push(`AND ta.class_id = $${assignmentParams.length}`);
    }
    if (filters.divisionId !== undefined) {
      assignmentParams.push(filters.divisionId);
      assignmentConditions.push(`AND t.division_id = $${assignmentParams.length}`);
    }

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
        ${assignmentConditions.join("\n        ")}
      ORDER BY d.id ASC, c.id ASC, b.id ASC, t.name_bn ASC
      `,
      assignmentParams,
    );

    return {
      rows: Array.isArray(assignmentRows) ? assignmentRows : [],
      warning: ROUTINE_FALLBACK_WARNING,
    };
  }

  findAcademicAdmissions(madrasaId: number, filters: RosterFilters = {}) {
    const { conditions, params } = buildRosterFilterSql(madrasaId, filters);
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
        ${conditions}
      ORDER BY s.admission_date DESC NULLS LAST, s.id DESC
      `,
      params,
    );
  }

  findGuardianPhones(madrasaId: number, filters: RosterFilters = {}) {
    const { conditions, params } = buildRosterFilterSql(madrasaId, filters);
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
        ${conditions}
      ORDER BY d.id ASC, c.id ASC, s.roll ASC NULLS LAST, s.name_bn ASC
      `,
      params,
    );
  }

  /** Rank 1-3 winners for a single exam, used to auto-generate prize book
   * labels. When mumtazOnly is set, further restricts to students holding
   * the madrasa's top grade band (highest min_mark) - matched dynamically
   * instead of a hardcoded grade name, since grade names are per-madrasa
   * configurable (see MadrasaGrade). */
  findPrizeBookLabels(madrasaId: number, examId?: number, mumtazOnly?: boolean, filters: RosterFilters = {}) {
    const params: any[] = [madrasaId, examId || null, !!mumtazOnly];
    const conditions: string[] = [];
    if (filters.classId !== undefined) {
      params.push(filters.classId);
      conditions.push(`AND s.class_id = $${params.length}`);
    }
    if (filters.divisionId !== undefined) {
      params.push(filters.divisionId);
      conditions.push(`AND s.division_id = $${params.length}`);
    }

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
        s.name_bn AS student_name,
        s.father_name,
        COALESCE(c.name_bn, c.name) AS class_name,
        COALESCE(d.name_bn, d.name) AS division_name,
        e.id AS exam_id,
        e.name AS exam_name,
        e.year AS exam_year,
        rs.total,
        rs.average,
        rs.madrasa_grade,
        rs.general_grade,
        rs.rank_no
      FROM results_summary rs
      INNER JOIN students s ON s.id = rs.student_id
      INNER JOIN results_master rm ON rm.id = rs.result_master_id
      CROSS JOIN selected_exam e
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN divisions d ON d.id = s.division_id
      WHERE s.madrasa_id = $1
        AND s.deleted_at IS NULL
        AND s.is_active = 1
        AND rm.status = 'PUBLISHED'
        AND rm.exam_id = e.id
        AND rs.rank_no IN (1, 2, 3)
        AND ($3::boolean IS NOT TRUE OR rs.madrasa_grade = (
          -- Top band of the scale that applies to this result's class: the
          -- division's own madrasa_grades rows when it has any, otherwise the
          -- madrasa-wide default (division_id NULL) scale.
          SELECT mg.name
          FROM madrasa_grades mg
          WHERE mg.madrasa_id = $1
            AND mg.division_id IS NOT DISTINCT FROM (
              SELECT CASE
                WHEN EXISTS (
                  SELECT 1 FROM madrasa_grades own
                  WHERE own.madrasa_id = $1 AND own.division_id = rmc.division_id
                ) THEN rmc.division_id
              END
              FROM classes rmc
              WHERE rmc.id = rm.class_id
            )
          ORDER BY mg.min_mark DESC
          LIMIT 1
        ))
        ${conditions.join("\n        ")}
      ORDER BY d.id ASC, c.id ASC, rs.rank_no ASC
      `,
      params,
    );
  }

  findExamSignatureSheet(madrasaId: number, examId?: number, filters: RosterFilters = {}) {
    const params: any[] = [madrasaId, examId || null];
    const conditions: string[] = [];
    if (filters.classId !== undefined) {
      params.push(filters.classId);
      conditions.push(`AND s.class_id = $${params.length}`);
    }
    if (filters.divisionId !== undefined) {
      params.push(filters.divisionId);
      conditions.push(`AND s.division_id = $${params.length}`);
    }

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
        e.year AS exam_year,
        COALESCE(
          jsonb_agg(
            jsonb_build_object('book_id', b.id, 'subject_name', COALESCE(b.name_bn, b.name))
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
      WHERE s.madrasa_id = $1
        AND s.deleted_at IS NULL
        AND s.is_active = 1
        ${conditions.join("\n        ")}
      GROUP BY
        s.id,
        s.registration_no,
        s.roll,
        s.division_id,
        s.class_id,
        s.academic_year,
        s.name_bn,
        s.father_name,
        c.id,
        c.name_bn,
        c.name,
        d.id,
        d.name_bn,
        d.name,
        e.id,
        e.name,
        e.year
      ORDER BY d.id ASC, c.id ASC, s.roll ASC NULLS LAST, s.name_bn ASC
      `,
      params,
    );
  }

  findExamNumberSheet(madrasaId: number, examId?: number, filters: RosterFilters = {}) {
    const params: any[] = [madrasaId, examId || null];
    const conditions: string[] = [];
    if (filters.classId !== undefined) {
      params.push(filters.classId);
      conditions.push(`AND s.class_id = $${params.length}`);
    }
    if (filters.divisionId !== undefined) {
      params.push(filters.divisionId);
      conditions.push(`AND s.division_id = $${params.length}`);
    }

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
              'full_marks', COALESCE(mb.full_mark, 100),
              'mark', m.mark,
              'is_absent', COALESCE(m.is_absent, false)
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
        ${conditions.join("\n        ")}
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
      params,
    );
  }

  /** Shared by the exam-routine (chronological) and room-wise-routine
   * (grouped/sorted by room) reports - same rows, just a different ORDER BY,
   * exactly like findAcademicResults/findAcademicResultsByRank share
   * academicResultsQuery above. Reads exam_routines (see
   * prisma/models/routine.prisma's ExamRoutine) - per-subject exam-day slots
   * with an optional room number, distinct from the weekly ClassRoutine. */
  findExamRoutineList(
    madrasaId: number,
    examId: number | undefined,
    filters: ExamRoutineFilters = {},
    orderByRoom = false,
  ) {
    const params: any[] = [madrasaId, examId || null];
    const conditions: string[] = [];
    if (filters.classId !== undefined) {
      params.push(filters.classId);
      conditions.push(`AND er.class_id = $${params.length}`);
    }
    if (filters.divisionId !== undefined) {
      params.push(filters.divisionId);
      conditions.push(`AND c.division_id = $${params.length}`);
    }

    const orderBySql = orderByRoom
      ? "ORDER BY er.room_no ASC NULLS LAST, er.exam_date ASC, er.start_time ASC, c.id ASC"
      : "ORDER BY er.exam_date ASC, er.start_time ASC, c.id ASC";

    return this.runQuery(
      `
      SELECT
        er.id,
        er.exam_id,
        er.class_id,
        c.division_id,
        er.subject AS subject_name,
        er.exam_date,
        er.start_time,
        er.end_time,
        er.room_no,
        COALESCE(c.name_bn, c.name) AS class_name,
        COALESCE(d.name_bn, d.name) AS division_name,
        e.name AS exam_name,
        e.year AS exam_year
      FROM exam_routines er
      INNER JOIN classes c ON c.id = er.class_id
      LEFT JOIN divisions d ON d.id = c.division_id
      LEFT JOIN exams e ON e.id = er.exam_id
      WHERE er.madrasa_id = $1
        AND ($2::int IS NULL OR er.exam_id = $2::int)
        ${conditions.join("\n        ")}
      ${orderBySql}
      `,
      params,
    );
  }

  /** Seat plan: one row per candidate per exam-day slot, reading the real
   * SeatAllocation/ExamRoom data the exam-operations phase populates -
   * previously there was no report at all surfacing this table. */
  findSeatPlan(madrasaId: number, examId: number | undefined, filters: SeatPlanFilters = {}) {
    const params: any[] = [madrasaId, examId || null];
    const conditions: string[] = [];
    if (filters.roomId !== undefined) {
      params.push(filters.roomId);
      conditions.push(`AND room.id = $${params.length}`);
    }
    if (filters.classId !== undefined) {
      params.push(filters.classId);
      conditions.push(`AND ec.class_id = $${params.length}`);
    }
    if (filters.divisionId !== undefined) {
      params.push(filters.divisionId);
      conditions.push(`AND ec.division_id = $${params.length}`);
    }

    return this.runQuery(
      `
      SELECT
        esa.id,
        esa.seat_no,
        esa.row_no,
        esa.column_no,
        er.id AS exam_routine_id,
        er.exam_date,
        er.start_time,
        er.end_time,
        er.subject AS subject_name,
        room.id AS room_id,
        room.name AS room_name,
        room.code AS room_code,
        ec.id AS exam_candidate_id,
        ec.registration_no,
        ec.candidate_no,
        s.id AS student_id,
        s.name_bn AS student_name,
        s.roll,
        COALESCE(c.name_bn, c.name) AS class_name,
        COALESCE(d.name_bn, d.name) AS division_name,
        e.name AS exam_name,
        e.year AS exam_year
      FROM exam_seat_allocations esa
      INNER JOIN exam_routines er ON er.id = esa.exam_routine_id
      INNER JOIN exam_rooms room ON room.id = esa.room_id
      INNER JOIN exam_candidates ec ON ec.id = esa.exam_candidate_id
      INNER JOIN students s ON s.id = ec.student_id
      LEFT JOIN classes c ON c.id = ec.class_id
      LEFT JOIN divisions d ON d.id = ec.division_id
      LEFT JOIN exams e ON e.id = er.exam_id
      WHERE esa.madrasa_id = $1
        AND ($2::int IS NULL OR er.exam_id = $2::int)
        ${conditions.join("\n        ")}
      ORDER BY room.name ASC NULLS LAST, er.exam_date ASC, er.start_time ASC, esa.seat_no ASC
      `,
      params,
    );
  }

  /** Invigilator list: one row per assignment per exam-day slot, reading
   * ExamInvigilatorAssignment - previously there was no report surfacing
   * this table at all. invigilator_type/invigilator_id is a generic
   * type+id pointer (no Prisma relation, see exam-operations.prisma), so
   * the name/phone are resolved with a LEFT JOIN per possible type instead
   * of a single FK join. */
  findInvigilatorList(madrasaId: number, examId: number | undefined, filters: InvigilatorListFilters = {}) {
    const params: any[] = [madrasaId, examId || null];
    const conditions: string[] = [];
    if (filters.roomId !== undefined) {
      params.push(filters.roomId);
      conditions.push(`AND room.id = $${params.length}`);
    }

    return this.runQuery(
      `
      SELECT
        eia.id,
        eia.invigilator_type,
        eia.invigilator_id,
        eia.role,
        eia.status,
        er.id AS exam_routine_id,
        er.exam_date,
        er.start_time,
        er.end_time,
        er.subject AS subject_name,
        room.id AS room_id,
        room.name AS room_name,
        room.code AS room_code,
        COALESCE(t.name_bn, st.name_bn) AS invigilator_name,
        COALESCE(t.phone, st.phone) AS invigilator_phone,
        e.name AS exam_name,
        e.year AS exam_year
      FROM exam_invigilator_assignments eia
      INNER JOIN exam_routines er ON er.id = eia.exam_routine_id
      LEFT JOIN exam_rooms room ON room.id = er.room_id
      LEFT JOIN teachers t ON t.id = eia.invigilator_id AND eia.invigilator_type = 'TEACHER'
      LEFT JOIN staff st ON st.id = eia.invigilator_id AND eia.invigilator_type = 'STAFF'
      LEFT JOIN exams e ON e.id = er.exam_id
      WHERE eia.madrasa_id = $1
        AND ($2::int IS NULL OR er.exam_id = $2::int)
        AND eia.status != 'CANCELLED'
        ${conditions.join("\n        ")}
      ORDER BY er.exam_date ASC, er.start_time ASC, room.name ASC NULLS LAST, eia.role ASC
      `,
      params,
    );
  }

  /** Exam-day roll-call/attendance sheet - reads the real ExamAttendance
   * model (per exam-routine slot, PRESENT/ABSENT/LATE/EXCUSED/WITHHELD),
   * NOT the generic daily Attendance table (that's findDailyAttendance/
   * findDigitalAttendance above, a different report for a different
   * purpose) and NOT Mark.isAbsent (that's findAbsentCandidates - "missing
   * marks", not "who sat in the exam hall"). Previously there was no report
   * reading exam_attendances at all. */
  findExamAttendanceSheet(
    madrasaId: number,
    examId: number | undefined,
    filters: ExamAttendanceSheetFilters = {},
  ) {
    const params: any[] = [madrasaId, examId || null];
    const conditions: string[] = [];
    if (filters.roomId !== undefined) {
      params.push(filters.roomId);
      conditions.push(`AND COALESCE(room.id, ea.room_id) = $${params.length}`);
    }
    if (filters.classId !== undefined) {
      params.push(filters.classId);
      conditions.push(`AND ec.class_id = $${params.length}`);
    }
    if (filters.divisionId !== undefined) {
      params.push(filters.divisionId);
      conditions.push(`AND ec.division_id = $${params.length}`);
    }

    return this.runQuery(
      `
      SELECT
        ea.id,
        ea.status,
        ea.remarks,
        ea.marked_at,
        ea.is_locked,
        er.id AS exam_routine_id,
        er.exam_date,
        er.start_time,
        er.end_time,
        er.subject AS subject_name,
        room.id AS room_id,
        room.name AS room_name,
        room.code AS room_code,
        ec.id AS exam_candidate_id,
        ec.registration_no,
        ec.candidate_no,
        s.id AS student_id,
        s.name_bn AS student_name,
        s.roll,
        COALESCE(c.name_bn, c.name) AS class_name,
        COALESCE(d.name_bn, d.name) AS division_name,
        e.name AS exam_name,
        e.year AS exam_year
      FROM exam_attendances ea
      INNER JOIN exam_routines er ON er.id = ea.exam_routine_id
      INNER JOIN exam_candidates ec ON ec.id = ea.exam_candidate_id
      INNER JOIN students s ON s.id = ec.student_id
      LEFT JOIN exam_rooms room ON room.id = ea.room_id
      LEFT JOIN classes c ON c.id = ec.class_id
      LEFT JOIN divisions d ON d.id = ec.division_id
      LEFT JOIN exams e ON e.id = er.exam_id
      WHERE ea.madrasa_id = $1
        AND ($2::int IS NULL OR er.exam_id = $2::int)
        ${conditions.join("\n        ")}
      ORDER BY er.exam_date ASC, er.start_time ASC, s.roll ASC NULLS LAST
      `,
      params,
    );
  }

  /** The exam candidate roster - candidates actually REGISTERED for this
   * exam (exam_candidates), not just "every active student in this class"
   * (same fix as findStudentAdmitCards, see its doc-comment for the full
   * rationale: a student who never registered, or whose registration was
   * CANCELLED, must not appear as an exam candidate).
   *
   * Filters (class_id/division_id) are applied against the CANDIDATE's
   * snapshotted ec.class_id/ec.division_id, not the student's current
   * s.class_id/s.division_id - ExamCandidate captures class/division/session
   * at registration time specifically so a later promotion never rewrites
   * an already-registered candidate's exam-time class/division (see
   * exam-candidate.prisma's model doc-comment). ec.session_id is also
   * surfaced in the row for the same reason: it's the session the
   * candidate was actually registered under, which may differ from the
   * session on their live Student row if a promotion/session change
   * happened after registration.
   *
   * This is a MANAGEMENT ROSTER, not a participation list - it
   * intentionally excludes only CANCELLED (true withdrawals), keeping
   * WITHHELD/INELIGIBLE candidates visible (with their status/
   * eligibility_status columns) so office staff can see and act on them.
   * Contrast with findStudentAdmitCards, exam-seat/exam-attendance's
   * "eligible candidates" queries, etc., which use the stricter
   * canCandidateParticipate() rule (see exam-candidate.policy.ts) since
   * those grant actual participation (an admit card, a seat, an attendance
   * mark), not just visibility.
   *
   * Falls back to the plain active-student roster (old behavior, no
   * candidate/session/status columns) with a warning when the resolved
   * exam has zero ExamCandidate rows - a madrasa that never adopted exam
   * candidate registration must keep seeing a usable roster here, not a
   * suddenly-empty report. */
  async findExamCandidateList(
    madrasaId: number,
    examId: number | undefined,
    filters: RosterFilters = {},
  ): Promise<OptionalQueryResult<any>> {
    const params: any[] = [madrasaId, examId || null];
    const conditions: string[] = [];
    if (filters.classId !== undefined) {
      params.push(filters.classId);
      conditions.push(`AND ec.class_id = $${params.length}`);
    }
    if (filters.divisionId !== undefined) {
      params.push(filters.divisionId);
      conditions.push(`AND ec.division_id = $${params.length}`);
    }
    if (filters.studentIds !== undefined && filters.studentIds.length > 0) {
      params.push(filters.studentIds);
      conditions.push(`AND s.id = ANY($${params.length}::int[])`);
    }

    const result = await this.runOptionalQuery(
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
        ec.division_id,
        ec.class_id,
        ec.session_id,
        s.academic_year,
        s.name_bn AS student_name,
        s.father_name,
        s.mother_name,
        s.guardian_phone,
        COALESCE(c.name_bn, c.name) AS class_name,
        COALESCE(d.name_bn, d.name) AS division_name,
        e.id AS exam_id,
        e.name AS exam_name,
        e.year AS exam_year,
        ec.id AS exam_candidate_id,
        ec.registration_no AS exam_registration_no,
        ec.candidate_no,
        ec.status AS candidate_status,
        ec.eligibility_status
      FROM students s
      CROSS JOIN selected_exam e
      INNER JOIN exam_candidates ec
        ON ec.student_id = s.id AND ec.exam_id = e.id AND ec.madrasa_id = $1
      LEFT JOIN classes c ON c.id = ec.class_id
      LEFT JOIN divisions d ON d.id = ec.division_id
      WHERE s.madrasa_id = $1
        AND s.deleted_at IS NULL
        AND ec.status != 'CANCELLED'
        ${conditions.join("\n        ")}
      ORDER BY d.id ASC, c.id ASC, COALESCE(s.roll, 0) ASC, s.name_bn ASC
      `,
      params,
    );

    if (result.rows.length) return result;

    // Same distinction as findStudentAdmitCards's fallback guard (see its
    // comment): only fall back to the plain roster when this exam has NO
    // ExamCandidate rows at all, not when every registered candidate
    // happens to be CANCELLED right now.
    if (await this.examHasAnyCandidates(madrasaId, examId)) {
      return result;
    }
    return this.examCandidateRosterFallback(madrasaId, filters);
  }

  private async examCandidateRosterFallback(
    madrasaId: number,
    filters: RosterFilters,
  ): Promise<OptionalQueryResult<any>> {
    const roster = await this.findActiveStudentRoster(madrasaId, filters);
    return {
      rows: roster.map((row: any) => ({
        ...row,
        session_id: null,
        exam_id: null,
        exam_name: "—",
        exam_year: row.academic_year || "—",
        exam_candidate_id: null,
        exam_registration_no: null,
        candidate_no: null,
        candidate_status: null,
        eligibility_status: null,
      })),
      warning: EXAM_CANDIDATE_LIST_FALLBACK_WARNING,
    };
  }

  /** Students marked absent (Mark.isAbsent) for an exam, one row per
   * absent subject - there's no separate attendance-sheet table for exams
   * (see exam.prisma), Mark.isAbsent is the only source of truth. */
  findAbsentCandidates(madrasaId: number, examId: number | undefined, filters: AbsentCandidateFilters = {}) {
    const params: any[] = [madrasaId, examId || null];
    const conditions: string[] = [];
    if (filters.classId !== undefined) {
      params.push(filters.classId);
      conditions.push(`AND m.class_id = $${params.length}`);
    }
    if (filters.divisionId !== undefined) {
      params.push(filters.divisionId);
      conditions.push(`AND c.division_id = $${params.length}`);
    }

    return this.runQuery(
      `
      SELECT
        m.id,
        s.id AS student_id,
        s.registration_no,
        s.roll,
        s.division_id,
        s.class_id,
        s.name_bn AS student_name,
        s.father_name,
        COALESCE(c.name_bn, c.name) AS class_name,
        COALESCE(d.name_bn, d.name) AS division_name,
        COALESCE(b.name_bn, b.name) AS subject_name,
        e.name AS exam_name,
        e.year AS exam_year
      FROM marks m
      INNER JOIN students s ON s.id = m.student_id
      INNER JOIN exams e ON e.id = m.exam_id
      LEFT JOIN classes c ON c.id = m.class_id
      LEFT JOIN divisions d ON d.id = c.division_id
      LEFT JOIN books b ON b.id = m.book_id
      WHERE m.madrasa_id = $1
        AND m.is_absent = true
        AND s.deleted_at IS NULL
        AND ($2::int IS NULL OR m.exam_id = $2::int)
        ${conditions.join("\n        ")}
      ORDER BY d.id ASC, c.id ASC, s.roll ASC NULLS LAST, b.id ASC
      `,
      params,
    );
  }

  /** Published results filtered down to one status (PASS/FAIL) - the "ফেল
   * তালিকা"/"পাশ তালিকা" reports. Deliberately lighter than
   * academicResultsQuery (no per-subject jsonb aggregation) since these
   * lists only need the summary columns. */
  findResultsByStatus(
    madrasaId: number,
    status: "PASS" | "FAIL",
    filters: ResultStatusFilters = {},
  ) {
    const params: any[] = [madrasaId, status];
    const conditions: string[] = [];
    if (filters.examId !== undefined) {
      params.push(filters.examId);
      conditions.push(`AND rm.exam_id = $${params.length}`);
    }
    if (filters.classId !== undefined) {
      params.push(filters.classId);
      conditions.push(`AND s.class_id = $${params.length}`);
    }
    if (filters.divisionId !== undefined) {
      params.push(filters.divisionId);
      conditions.push(`AND s.division_id = $${params.length}`);
    }

    return this.runQuery(
      `
      SELECT
        s.id,
        s.id AS student_id,
        s.registration_no,
        COALESCE(rs.roll, s.roll) AS roll,
        s.division_id,
        s.class_id,
        s.name_bn AS student_name,
        s.father_name,
        s.guardian_phone,
        COALESCE(c.name_bn, c.name) AS class_name,
        COALESCE(d.name_bn, d.name) AS division_name,
        e.name AS exam_name,
        e.year AS exam_year,
        rs.total,
        rs.average,
        rs.madrasa_grade,
        rs.general_grade,
        rs.status,
        rs.rank_no
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
        AND rs.status = $2
        ${conditions.join("\n        ")}
      ORDER BY d.id ASC, c.id ASC, rs.rank_no ASC NULLS LAST, COALESCE(rs.roll, s.roll) ASC NULLS LAST
      `,
      params,
    );
  }

  /** Average/highest/lowest mark per subject (book) for an exam+class -
   * "বিষয়ভিত্তিক ফলাফল বিশ্লেষণ". Reads directly from marks, not
   * results_summary, so it works even before a result is published. */
  findSubjectPerformance(madrasaId: number, filters: SubjectPerformanceFilters = {}) {
    const params: any[] = [madrasaId];
    const conditions: string[] = [];
    if (filters.examId !== undefined) {
      params.push(filters.examId);
      conditions.push(`AND m.exam_id = $${params.length}`);
    }
    if (filters.classId !== undefined) {
      params.push(filters.classId);
      conditions.push(`AND m.class_id = $${params.length}`);
    }
    if (filters.divisionId !== undefined) {
      params.push(filters.divisionId);
      conditions.push(`AND c.division_id = $${params.length}`);
    }

    return this.runQuery(
      `
      SELECT
        b.id AS book_id,
        COALESCE(b.name_bn, b.name) AS subject_name,
        COALESCE(mb.full_mark, 100) AS full_marks,
        COUNT(m.id)::int AS candidate_count,
        COUNT(*) FILTER (WHERE m.is_absent)::int AS absent_count,
        ROUND(AVG(m.mark) FILTER (WHERE NOT m.is_absent)::numeric, 2) AS average_mark,
        MAX(m.mark) FILTER (WHERE NOT m.is_absent) AS highest_mark,
        MIN(m.mark) FILTER (WHERE NOT m.is_absent) AS lowest_mark,
        COUNT(*) FILTER (WHERE NOT m.is_absent AND m.mark >= COALESCE(mb.pass_mark, 33))::int AS pass_count
      FROM marks m
      INNER JOIN books b ON b.id = m.book_id
      LEFT JOIN classes c ON c.id = m.class_id
      LEFT JOIN madrasa_books mb
        ON mb.book_id = b.id
        AND mb.madrasa_id = $1
        AND COALESCE(mb.is_active, 1) = 1
      WHERE m.madrasa_id = $1
        ${conditions.join("\n        ")}
      GROUP BY b.id, b.name_bn, b.name, mb.full_mark
      ORDER BY b.id ASC
      `,
      params,
    );
  }

  /** Per-class summary for one exam - candidate count, pass %, average,
   * top scorer. Only counts classes whose result has been published
   * (matches every other results_summary-driven report's PUBLISHED gate). */
  findExamSummary(madrasaId: number, filters: ExamSummaryFilters = {}) {
    const params: any[] = [madrasaId, filters.examId || null];
    const conditions: string[] = [];
    if (filters.classId !== undefined) {
      params.push(filters.classId);
      conditions.push(`AND rm.class_id = $${params.length}`);
    }
    if (filters.divisionId !== undefined) {
      params.push(filters.divisionId);
      conditions.push(`AND c.division_id = $${params.length}`);
    }

    return this.runQuery(
      `
      SELECT
        rm.id AS result_master_id,
        rm.exam_id,
        rm.class_id,
        c.division_id,
        COALESCE(c.name_bn, c.name) AS class_name,
        COALESCE(d.name_bn, d.name) AS division_name,
        e.name AS exam_name,
        e.year AS exam_year,
        COUNT(rs.id)::int AS candidate_count,
        COUNT(*) FILTER (WHERE rs.status = 'PASS')::int AS pass_count,
        COUNT(*) FILTER (WHERE rs.status = 'FAIL')::int AS fail_count,
        COUNT(*) FILTER (WHERE rs.status = 'ABSENT')::int AS absent_count,
        ROUND(
          (COUNT(*) FILTER (WHERE rs.status = 'PASS')::numeric / NULLIF(COUNT(rs.id), 0)) * 100,
          2
        ) AS pass_percentage,
        ROUND(AVG(rs.average)::numeric, 2) AS average_mark,
        topper.student_name AS top_scorer_name,
        topper.total AS top_scorer_total
      FROM results_master rm
      INNER JOIN classes c ON c.id = rm.class_id
      LEFT JOIN divisions d ON d.id = c.division_id
      LEFT JOIN exams e ON e.id = rm.exam_id
      LEFT JOIN results_summary rs ON rs.result_master_id = rm.id
      LEFT JOIN LATERAL (
        SELECT s2.name_bn AS student_name, rs2.total
        FROM results_summary rs2
        INNER JOIN students s2 ON s2.id = rs2.student_id
        WHERE rs2.result_master_id = rm.id
        ORDER BY rs2.total DESC NULLS LAST
        LIMIT 1
      ) topper ON true
      WHERE rm.madrasa_id = $1
        AND rm.deleted_at IS NULL
        AND rm.status = 'PUBLISHED'
        AND ($2::int IS NULL OR rm.exam_id = $2::int)
        ${conditions.join("\n        ")}
      GROUP BY
        rm.id, rm.exam_id, rm.class_id, c.division_id, c.name_bn, c.name,
        d.name_bn, d.name, e.name, e.year, topper.student_name, topper.total
      ORDER BY c.id ASC
      `,
      params,
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

  findStudentIdCards(madrasaId: number, filters: RosterFilters = {}) {
    return this.findActiveStudentRoster(madrasaId, filters);
  }

  /** Marksheets for every PUBLISHED result the student has. Without an
   * examId, a student with multiple published exams (e.g. প্রথম সাময়িক AND
   * বার্ষিক) gets ALL of them mixed together in one result set, ordered
   * most-recent-first - fine for an "all of this student's history" view,
   * but almost never what "print marksheets for THIS exam" actually wants.
   * Pass examId to scope to exactly one exam's results (see
   * DocumentsReportPage.tsx's "student-marksheets" report, which now sets
   * requiresExam so the admin UI always passes one). */
  async findStudentMarksheets(
    madrasaId: number,
    examId?: number,
    filters: RosterFilters = {},
  ): Promise<OptionalQueryResult<any>> {
    const { conditions: filterConditions, params: filterParams } = buildRosterFilterSql(madrasaId, filters);
    const params = [...filterParams, examId || null];
    const examIdParamIndex = params.length;
    const conditions = `${filterConditions}\n        AND ($${examIdParamIndex}::int IS NULL OR rm.exam_id = $${examIdParamIndex}::int)`;
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
        s.dob AS date_of_birth,
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
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'book_id', b.id,
              'subject_name', COALESCE(b.name_bn, b.name),
              'full_marks', COALESCE(mb.full_mark, 100),
              'mark', m.mark,
              'is_absent', COALESCE(m.is_absent, false)
            )
            ORDER BY COALESCE(mb.sort_order, 0), b.id
          ) FILTER (WHERE b.id IS NOT NULL),
          '[]'::jsonb
        ) AS subjects
      FROM results_summary rs
      INNER JOIN students s ON s.id = rs.student_id
      INNER JOIN results_master rm ON rm.id = rs.result_master_id
      LEFT JOIN exams e ON e.id = rm.exam_id
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN divisions d ON d.id = s.division_id
      LEFT JOIN madrasa_books mb
        ON mb.madrasa_id = s.madrasa_id
        AND COALESCE(mb.is_active, 1) = 1
      LEFT JOIN books b
        ON b.id = mb.book_id
        AND b.class_id = s.class_id
      LEFT JOIN marks m
        ON m.result_master_id = rm.id
        AND m.student_id = s.id
        AND m.book_id = b.id
      WHERE s.madrasa_id = $1
        AND s.deleted_at IS NULL
        AND s.is_active = 1
        AND rm.status = 'PUBLISHED'
        ${conditions}
      GROUP BY
        s.id,
        s.registration_no,
        s.roll,
        s.division_id,
        s.class_id,
        s.academic_year,
        s.name_bn,
        s.father_name,
        s.guardian_phone,
        s.dob,
        c.name_bn,
        c.name,
        d.name_bn,
        d.name,
        e.name,
        e.year,
        rs.roll,
        rs.total,
        rs.average,
        rs.general_grade,
        rs.madrasa_grade,
        rs.status,
        rs.rank_no,
        rm.status,
        rm.id
      ORDER BY rm.id DESC, rs.rank_no ASC NULLS LAST, COALESCE(rs.roll, s.roll) ASC NULLS LAST
      `,
      params,
    );

    if (result.rows.length) return result;
    return this.resultRosterFallback(madrasaId, filters);
  }

  findStudentCertificates(madrasaId: number, filters: RosterFilters = {}) {
    const { conditions, params } = buildRosterFilterSql(madrasaId, filters);
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
        ${conditions}
      ORDER BY s.roll ASC NULLS LAST, s.id DESC
      `,
      params,
    );
  }

  /** Admit cards for candidates actually REGISTERED for an exam (exam_candidates),
   * not just "every active student" - a student who never registered, or
   * whose registration was cancelled/found ineligible, must not get a card.
   * Respects an explicit examId the same way findExamSignatureSheet/
   * findExamNumberSheet do (selected_exam CTE: matches the requested exam,
   * falls back to the most recent one only when none is given), unlike the
   * old version of this query which ignored examId entirely and always used
   * `ORDER BY id DESC LIMIT 1`. Seat/room come from the candidate's
   * EARLIEST exam_routine slot's seat allocation - most madrasas keep one
   * room+seat for a candidate across the whole exam, so this is shown as
   * "the" seat; a candidate whose room/seat changes per subject will only
   * see their first slot's assignment here (the seat-plan report is the
   * authoritative per-slot source).
   *
   * Falls back to the plain active-student roster (same shape as before
   * this fix, no seat/room, exam_name "—") with a warning when zero
   * candidates are registered for the resolved exam - a madrasa that never
   * adopted exam candidate registration must keep getting admit cards for
   * its whole roster, not a suddenly-empty report. */
  async findStudentAdmitCards(
    madrasaId: number,
    examId?: number,
    filters: RosterFilters = {},
  ): Promise<OptionalQueryResult<any>> {
    const params: any[] = [madrasaId, examId || null];
    const conditions: string[] = [];
    if (filters.classId !== undefined) {
      params.push(filters.classId);
      conditions.push(`AND s.class_id = $${params.length}`);
    }
    if (filters.divisionId !== undefined) {
      params.push(filters.divisionId);
      conditions.push(`AND s.division_id = $${params.length}`);
    }
    if (filters.studentIds !== undefined && filters.studentIds.length > 0) {
      params.push(filters.studentIds);
      conditions.push(`AND s.id = ANY($${params.length}::int[])`);
    }

    const result = await this.runOptionalQuery(
      `
      WITH selected_exam AS (
        SELECT e.id, e.name, e.year
        FROM exams e
        WHERE e.madrasa_id = $1
          AND e.deleted_at IS NULL
          AND ($2::int IS NULL OR e.id = $2::int)
        ORDER BY CASE WHEN e.id = $2::int THEN 0 ELSE 1 END, e.id DESC
        LIMIT 1
      ),
      candidate_seat AS (
        SELECT DISTINCT ON (esa.exam_candidate_id)
          esa.exam_candidate_id, esa.seat_no, esa.room_id
        FROM exam_seat_allocations esa
        INNER JOIN exam_routines er ON er.id = esa.exam_routine_id
        WHERE esa.madrasa_id = $1
        ORDER BY esa.exam_candidate_id, er.exam_date ASC, er.start_time ASC
      )
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
        e.id AS exam_id,
        e.name AS exam_name,
        e.year AS exam_year,
        ec.id AS exam_candidate_id,
        ec.registration_no AS exam_registration_no,
        ec.candidate_no,
        ec.status AS candidate_status,
        cs.seat_no,
        room.id AS room_id,
        room.name AS room_name,
        room.code AS room_code
      FROM students s
      CROSS JOIN selected_exam e
      INNER JOIN exam_candidates ec
        ON ec.student_id = s.id AND ec.exam_id = e.id AND ec.madrasa_id = $1
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN divisions d ON d.id = s.division_id
      LEFT JOIN candidate_seat cs ON cs.exam_candidate_id = ec.id
      LEFT JOIN exam_rooms room ON room.id = cs.room_id
      WHERE s.madrasa_id = $1
        AND s.deleted_at IS NULL
        AND s.is_active = 1
        AND ${examCandidateParticipationSql()}
        ${conditions.join("\n        ")}
      ORDER BY s.roll ASC NULLS LAST, s.id DESC
      `,
      params,
    );

    if (result.rows.length) return result;

    // Only fall back to "every active student" when this exam has NO
    // ExamCandidate rows at all (a madrasa that never adopted candidate
    // registration - see the doc-comment above). If candidates ARE
    // registered but every one of them is currently excluded by
    // canCandidateParticipate (CANCELLED/WITHHELD/INELIGIBLE - e.g. every
    // candidate temporarily withheld), the correct answer is genuinely
    // zero admit cards, NOT the full school roster including students who
    // were never registered for this exam at all.
    if (await this.examHasAnyCandidates(madrasaId, examId)) {
      return result;
    }
    return this.admitCardRosterFallback(madrasaId, filters);
  }

  /** Resolves the same "requested exam, or most recent if omitted" exam
   * this file's selected_exam CTEs use, and checks whether it has ANY
   * ExamCandidate rows (regardless of status/eligibility) - used to tell
   * "candidate registration was never used for this exam" (fall back to
   * the plain roster) apart from "candidates exist but none currently
   * participate" (the correct answer is an honest empty result, not the
   * whole school roster). */
  private async examHasAnyCandidates(madrasaId: number, examId?: number): Promise<boolean> {
    const rows = await this.runQuery<{ exists: boolean }>(
      `
      WITH selected_exam AS (
        SELECT e.id
        FROM exams e
        WHERE e.madrasa_id = $1
          AND e.deleted_at IS NULL
          AND ($2::int IS NULL OR e.id = $2::int)
        ORDER BY CASE WHEN e.id = $2::int THEN 0 ELSE 1 END, e.id DESC
        LIMIT 1
      )
      SELECT EXISTS (
        SELECT 1 FROM exam_candidates ec, selected_exam e
        WHERE ec.madrasa_id = $1 AND ec.exam_id = e.id
      ) AS exists
      `,
      [madrasaId, examId || null],
    );
    return Boolean(rows[0]?.exists);
  }

  private async admitCardRosterFallback(
    madrasaId: number,
    filters: RosterFilters,
  ): Promise<OptionalQueryResult<any>> {
    const roster = await this.findActiveStudentRoster(madrasaId, filters);
    return {
      rows: roster.map((row: any) => ({
        ...row,
        exam_id: null,
        exam_name: "—",
        exam_year: row.academic_year || "—",
        exam_candidate_id: null,
        exam_registration_no: null,
        candidate_no: null,
        candidate_status: null,
        seat_no: null,
        room_id: null,
        room_name: null,
        room_code: null,
      })),
      warning: ADMIT_CARD_FALLBACK_WARNING,
    };
  }

  findStudentSanads(madrasaId: number, filters: RosterFilters = {}) {
    const { conditions, params } = buildRosterFilterSql(madrasaId, filters);
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
        ${conditions}
      ORDER BY s.roll ASC NULLS LAST, s.id DESC
      `,
      params,
    );
  }

  findStudentTransferLetters(madrasaId: number, filters: RosterFilters = {}) {
    const { conditions, params } = buildRosterFilterSql(madrasaId, filters);
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
        ${conditions}
      ORDER BY s.roll ASC NULLS LAST, s.id DESC
      `,
      params,
    );
  }

  /* ================= TEACHER ================= */

  findTeacherList(madrasaId: number, divisionId?: number) {
    const params: any[] = [madrasaId];
    const conditions: string[] = [];
    if (divisionId !== undefined) {
      params.push(divisionId);
      conditions.push(`AND t.division_id = $${params.length}`);
    }

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
        ${conditions.join("\n        ")}
      ORDER BY t.id DESC
      `,
      params,
    );
  }

  findTeacherPhones(madrasaId: number, divisionId?: number) {
    const params: any[] = [madrasaId];
    const conditions: string[] = [];
    if (divisionId !== undefined) {
      params.push(divisionId);
      conditions.push(`AND t.division_id = $${params.length}`);
    }

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
        ${conditions.join("\n        ")}
      ORDER BY t.name_bn ASC
      `,
      params,
    );
  }
}

export const reportsRepository = new ReportsRepository();
