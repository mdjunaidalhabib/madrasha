import { MarkComponentConfig, MarkComponentType, Prisma, ResultPublishStatus } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { examCandidateParticipationSql } from "../exam-candidate/exam-candidate.policy";
import { ClassStatusRow, OverviewStatusRow } from "./result-panel.types";

export class ResultPanelRepository {
  findResultMaster(madrasaId: number, examId: number, classId: number) {
    return prisma.resultMaster.findFirst({
      where: { madrasaId, examId, classId, deletedAt: null },
    });
  }

  findLatestResultMasterId(madrasaId: number, examId: number, classId: number) {
    return prisma.resultMaster.findFirst({
      where: { madrasaId, examId, classId, deletedAt: null },
      orderBy: { id: "desc" },
      select: { id: true },
    });
  }

  createResultMaster(madrasaId: number, examId: number, classId: number) {
    return prisma.resultMaster.create({
      data: { madrasaId, examId, classId, status: "DRAFT" },
    });
  }

  findResultMasterById(id: number, madrasaId: number) {
    return prisma.resultMaster.findFirst({
      where: { id, madrasaId, deletedAt: null },
      select: { id: true, examId: true, classId: true, status: true },
    });
  }

  /** Exam/class display names for the RESULT_PUBLISHED notification's
   * {exam}/{class} placeholders - kept separate from findResultMasterById
   * (whose scalar-only select is reused in several places that don't need
   * these joins). */
  findExamAndClassNames(examId: number, classId: number) {
    return Promise.all([
      prisma.exam.findUnique({ where: { id: examId }, select: { name: true } }),
      prisma.class.findUnique({ where: { id: classId }, select: { nameBn: true, name: true } }),
    ]);
  }

  softDeleteResultMaster(id: number, madrasaId: number) {
    return prisma.resultMaster.updateMany({
      where: { id, madrasaId },
      data: { deletedAt: new Date() },
    });
  }

  /** Upserts a batch of Mark rows, and — when a row carries a `components`
   * breakdown — replaces that mark's MarkComponentValue rows too. Does the
   * Mark side as ONE bulk `INSERT ... ON CONFLICT` round trip (raw SQL,
   * since Prisma has no native bulk-upsert) instead of N sequential
   * `tx.mark.upsert()` calls inside an interactive transaction — against a
   * remote DB (measured ~110ms/round-trip on this project's connection), a
   * full class's worth of rows (many students x many subjects) pushed that
   * old N-round-trip loop past Prisma's interactive-transaction timeout and
   * failed with "Transaction not found ... obtained before disconnecting".
   * Component values are similarly batched: one bulk delete + one bulk
   * insert, keyed off the ids the upsert's RETURNING clause hands back. */
  async upsertMarksWithComponentsInTransaction(
    rows: {
      upsertArgs: Prisma.MarkUpsertArgs;
      components?: { component: MarkComponentType; value: number }[] | null;
    }[],
  ) {
    if (!rows.length) return [];

    const fieldsOf = (r: (typeof rows)[number]) => {
      const create = r.upsertArgs.create as Prisma.MarkUncheckedCreateInput;
      return {
        resultMasterId: create.resultMasterId,
        studentId: create.studentId,
        examId: create.examId,
        classId: create.classId,
        bookId: create.bookId,
        mark: create.mark as number,
        isAbsent: Boolean(create.isAbsent),
        isExempted: Boolean(create.isExempted),
        isWithheld: Boolean(create.isWithheld),
        note: (create.note as string | null | undefined) ?? null,
        madrasaId: create.madrasaId,
      };
    };

    const valueRows = rows.map((r) => {
      const f = fieldsOf(r);
      return Prisma.sql`(${f.resultMasterId}, ${f.studentId}, ${f.examId}, ${f.classId}, ${f.bookId}, ${f.mark}, ${f.isAbsent}, ${f.isExempted}, ${f.isWithheld}, ${f.note}, ${f.madrasaId}, now(), now())`;
    });

    return prisma.$transaction(async (tx) => {
      const inserted = await tx.$queryRaw<{ id: number; student_id: number; book_id: number }[]>`
        INSERT INTO marks (
          result_master_id, student_id, exam_id, class_id, book_id,
          mark, is_absent, is_exempted, is_withheld, note, madrasa_id,
          created_at, updated_at
        )
        VALUES ${Prisma.join(valueRows)}
        ON CONFLICT (result_master_id, student_id, class_id, book_id)
        DO UPDATE SET
          mark = EXCLUDED.mark,
          exam_id = EXCLUDED.exam_id,
          is_absent = EXCLUDED.is_absent,
          is_exempted = EXCLUDED.is_exempted,
          is_withheld = EXCLUDED.is_withheld,
          note = EXCLUDED.note,
          updated_at = now()
        RETURNING id, student_id, book_id
      `;

      const markIdByKey = new Map<string, number>();
      for (const row of inserted) {
        markIdByKey.set(`${row.student_id}-${row.book_id}`, row.id);
      }

      const rowsWithComponents = rows.filter((r) => r.components);
      if (rowsWithComponents.length) {
        const markIds = rowsWithComponents
          .map((r) => {
            const f = fieldsOf(r);
            return markIdByKey.get(`${f.studentId}-${f.bookId}`);
          })
          .filter((id): id is number => id != null);

        if (markIds.length) {
          await tx.$executeRaw`DELETE FROM mark_component_values WHERE mark_id = ANY(${markIds})`;
        }

        const componentValueRows: Prisma.Sql[] = [];
        for (const r of rowsWithComponents) {
          const f = fieldsOf(r);
          const markId = markIdByKey.get(`${f.studentId}-${f.bookId}`);
          if (!markId || !r.components?.length) continue;
          for (const c of r.components) {
            componentValueRows.push(Prisma.sql`(${markId}, ${c.component}::"MarkComponentType", ${c.value})`);
          }
        }

        if (componentValueRows.length) {
          await tx.$executeRaw`
            INSERT INTO mark_component_values (mark_id, component, value)
            VALUES ${Prisma.join(componentValueRows)}
          `;
        }
      }

      return inserted;
    });
  }

  // NOTE: upsertArgs is intentionally typed `Prisma.MarkUpsertArgs`, not
  // `any`, so a mismatched `where` key (e.g. a wrong compound-unique name)
  // is caught at compile time instead of only surfacing as a runtime
  // "Save failed" toast.

  /** Removes marks a teacher cleared back to blank in the entry grid — an
   * upsert has no "delete" verb, so cleared cells are carried through
   * saveMarks() as their own batch instead of being silently dropped.
   * MarkComponentValue rows cascade-delete automatically (onDelete: Cascade
   * on the Mark relation). */
  deleteMarksInTransaction(
    resultMasterId: number,
    rows: { studentId: number; bookId: number }[],
  ) {
    return prisma.$transaction(
      rows.map((row) =>
        prisma.mark.deleteMany({
          where: { resultMasterId, studentId: row.studentId, bookId: row.bookId },
        }),
      ),
    );
  }

  findMarks(madrasaId: number, examId: number, classId: number, resultMasterId: number) {
    return prisma.mark.findMany({
      where: {
        madrasaId,
        examId,
        classId,
        resultMasterId,
        book: {
          madrasaBooks: {
            some: { madrasaId, isActive: 1 },
          },
        },
      },
      select: {
        studentId: true,
        bookId: true,
        mark: true,
        isAbsent: true,
        isExempted: true,
        isWithheld: true,
        note: true,
        resultMasterId: true,
        componentValues: { select: { component: true, value: true } },
      },
      orderBy: [{ studentId: "asc" }, { bookId: "asc" }],
    });
  }

  /** Current MarkSubmission status for a set of books within one
   * ResultMaster - used by saveMarks() to reject edits to a subject whose
   * marks have already been submitted/verified. */
  findMarkSubmissionsForBooks(resultMasterId: number, bookIds: number[]) {
    if (!bookIds.length) return Promise.resolve([]);
    return prisma.markSubmission.findMany({
      where: { resultMasterId, bookId: { in: bookIds } },
      select: { bookId: true, status: true },
    });
  }

  /** MarkComponentConfig rows for a set of books, covering both
   * exam-specific (examId = the given exam) and book-wide (examId = null)
   * rows in one query - callers pick whichever set applies per book (prefer
   * exam-specific, fall back to book-wide). Returns nothing for a book with
   * no configured breakdown, meaning it behaves exactly as before (a flat
   * `mark` field). */
  findMarkComponentConfigsForBooks(
    madrasaId: number,
    bookIds: number[],
    examId: number | null,
  ): Promise<MarkComponentConfig[]> {
    if (!bookIds.length) return Promise.resolve([]);
    return prisma.markComponentConfig.findMany({
      where: {
        madrasaId,
        bookId: { in: bookIds },
        OR: [...(examId ? [{ examId }] : []), { examId: null }],
      },
      orderBy: [{ bookId: "asc" }, { sortOrder: "asc" }],
    });
  }

  findSettings(madrasaId: number) {
    return prisma.setting.findMany({
      where: { madrasaId },
      select: { name: true, value: true },
    });
  }

  findGeneralGrades(madrasaId: number) {
    return prisma.generalGrade.findMany({ where: { madrasaId }, orderBy: { minMark: "desc" } });
  }

  findMadrasaGrades(madrasaId: number) {
    return prisma.madrasaGrade.findMany({ where: { madrasaId }, orderBy: { minMark: "desc" } });
  }

  groupMarksByStudent(madrasaId: number, examId: number, classId: number, resultMasterId: number) {
    return prisma.mark.groupBy({
      by: ["studentId"],
      where: {
        madrasaId,
        examId,
        classId,
        resultMasterId,
        book: {
          madrasaBooks: {
            some: { madrasaId, isActive: 1 },
          },
        },
        student: {
          madrasaId,
          classId,
          deletedAt: null,
          isActive: 1,
        },
      },
      _sum: { mark: true },
      _count: { _all: true },
    });
  }

  /** Per-student count of subjects marked absent (isAbsent = true) within a
   * result session — compared against the student's total entered-subject
   * count from groupMarksByStudent() to detect a student who missed every
   * subject, so their overall result can be flagged ABSENT instead of
   * PASS/FAIL (see ResultPanelService.rebuildResultSummary). */
  countAbsentMarksByStudent(
    madrasaId: number,
    examId: number,
    classId: number,
    resultMasterId: number,
  ) {
    return prisma.mark.groupBy({
      by: ["studentId"],
      where: {
        madrasaId,
        examId,
        classId,
        resultMasterId,
        isAbsent: true,
        book: {
          madrasaBooks: {
            some: { madrasaId, isActive: 1 },
          },
        },
        student: {
          madrasaId,
          classId,
          deletedAt: null,
          isActive: 1,
        },
      },
      _count: { _all: true },
    });
  }

  /** Mark rows flagged isExempted within a session, one row per exempted
   * (student, book) pair - used to compute each student's own personal
   * totalFullMarks deduction (exemption is per-student, not class-wide) in
   * ResultPanelService.rebuildResultSummary. */
  findExemptedMarksByStudent(
    madrasaId: number,
    examId: number,
    classId: number,
    resultMasterId: number,
  ) {
    return prisma.mark.findMany({
      where: {
        madrasaId,
        examId,
        classId,
        resultMasterId,
        isExempted: true,
        book: {
          madrasaBooks: { some: { madrasaId, isActive: 1 } },
        },
        student: { madrasaId, classId, deletedAt: null, isActive: 1 },
      },
      select: { studentId: true, bookId: true },
    });
  }

  /** Distinct studentIds with at least one isWithheld mark in this session -
   * these students are excluded entirely from ResultSummary generation
   * (no PASS/FAIL/ABSENT row, no rank) until the hold is cleared. */
  findWithheldStudentIds(madrasaId: number, examId: number, classId: number, resultMasterId: number) {
    return prisma.mark.findMany({
      where: {
        madrasaId,
        examId,
        classId,
        resultMasterId,
        isWithheld: true,
        student: { madrasaId, classId, deletedAt: null, isActive: 1 },
      },
      select: { studentId: true },
      distinct: ["studentId"],
    });
  }

  /** Advances a session to PROCESSING after a (re)process run. Clears any
   * prior resultVerified/approved marks since the underlying content just
   * changed and those sign-offs no longer apply to the new numbers.
   * DB-guarded on `expectedStatuses` (the same reprocessable-status list the
   * caller already checked in JS) so two concurrent process requests can't
   * both apply - returns false instead of writing when the guard misses. */
  async markResultMasterProcessed(
    resultMasterId: number,
    madrasaId: number,
    expectedStatuses: string[],
    processedBy: number,
  ): Promise<boolean> {
    const result = await prisma.resultMaster.updateMany({
      where: { id: resultMasterId, madrasaId, status: { in: expectedStatuses as any } },
      data: {
        status: "PROCESSING",
        processedAt: new Date(),
        processedBy,
        resultVerifiedAt: null,
        resultVerifiedBy: null,
        approvedAt: null,
        approvedBy: null,
      },
    });
    return result.count > 0;
  }

  /** Publishes a session and writes an accompanying ResultSnapshot (audit /
   * integrity record only in this phase - no read path renders from it yet)
   * in the same transaction. DB-guarded: only publishes when the row is
   * still APPROVED at write time - if a concurrent request already moved it
   * elsewhere, the update matches zero rows, the snapshot is never created,
   * and the transaction returns false instead of throwing. */
  async publishResultMasterWithSnapshot(
    resultMasterId: number,
    madrasaId: number,
    publishedBy: number,
    snapshotJson: string,
  ): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const now = new Date();
      const updated = await tx.resultMaster.updateMany({
        where: { id: resultMasterId, madrasaId, status: "APPROVED" },
        data: { status: "PUBLISHED", publishedAt: now, publishedBy },
      });
      if (updated.count === 0) return false;

      await tx.resultSnapshot.create({
        data: { madrasaId, resultMasterId, snapshotJson, reason: "PUBLISH", createdBy: publishedBy },
      });
      return true;
    });
  }

  findResultMastersByClass(madrasaId: number, classId: number) {
    return prisma.resultMaster.findMany({
      where: { madrasaId, classId, deletedAt: null },
      select: { id: true, examId: true, classId: true },
      orderBy: { id: "asc" },
    });
  }

  /** Current roll for a set of students, used to snapshot each student's
   * roll onto ResultSummary at the moment a result is processed - so later
   * promotions (which overwrite students.roll) don't retroactively change
   * the roll shown on already-processed marksheets/notices. */
  findRollsByStudentIds(studentIds: number[]) {
    return prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, roll: true },
    });
  }

  /** Ranked (rankNo asc = best first) student list for a processed result,
   * used as the merit order when reassigning classroom roll numbers. */
  findRankedStudentsForResult(resultMasterId: number) {
    return prisma.resultSummary.findMany({
      where: { resultMasterId },
      select: { studentId: true, rankNo: true },
      orderBy: [{ rankNo: "asc" }],
    });
  }

  /** Every active student currently in a class, used so roll reassignment
   * covers students without a result entry too (placed after ranked
   * students, in their existing roll order) instead of leaving gaps or
   * collisions. */
  /** "Real, enrolled" students of this class - matches student.service.ts's
   * listStudents (the entry-grid roster teachers actually see and enter
   * marks against): admissionStatus must be APPROVED too, not just
   * isActive. Without this, a PENDING/REJECTED-but-still-isActive row (e.g.
   * a rejected admission never flipped inactive) is invisible in the marks
   * grid yet still counted as "required" by findRequiredStudentsInClass /
   * applyRollByRank below, wrongly blocking submit or getting a roll
   * number for a student nobody can enter marks for. */
  findActiveStudentsInClass(madrasaId: number, classId: number) {
    return prisma.student.findMany({
      where: { madrasaId, classId, deletedAt: null, isActive: 1, admissionStatus: "APPROVED" },
      select: { id: true, roll: true, academicYear: true, nameBn: true },
      orderBy: [{ roll: "asc" }, { id: "asc" }],
    });
  }

  /** The ExamCandidate roster actually PARTICIPATING in one exam+class -
   * once exam-candidate registration is in place, this is the definitive
   * "who is really sitting this exam" list (100% of the class for free
   * exams, only fee-payers for paid ones), unlike findActiveStudentsInClass
   * above which just means "physically enrolled in the class" regardless of
   * whether they're actually a candidate for this particular exam. Uses the
   * canonical participation rule (exam-candidate.policy.ts's
   * canCandidateParticipate/examCandidateParticipationSql): excludes
   * CANCELLED/WITHHELD status and INELIGIBLE status/eligibilityStatus. Same
   * raw-SQL join pattern as exam-attendance.repository.ts's
   * findEligibleCandidatesForRoutine/findRosterForRoutine. May legitimately
   * return an empty array for an exam that predates candidate registration
   * - callers MUST fail open (see findRequiredStudentsInClass below)
   * instead of treating an empty roster as "nobody needs to be marked". */
  findParticipatingCandidatesInClass(
    madrasaId: number,
    examId: number,
    classId: number,
  ): Promise<{ id: number; nameBn: string; roll: number | null }[]> {
    return prisma.$queryRaw<{ id: number; nameBn: string; roll: number | null }[]>`
      SELECT s.id AS id, s.name_bn AS "nameBn", s.roll AS roll
      FROM exam_candidates ec
      JOIN students s ON s.id = ec.student_id
      WHERE ec.madrasa_id = ${madrasaId}
        AND ec.exam_id = ${examId}
        AND ec.class_id = ${classId}
        AND ${Prisma.raw(examCandidateParticipationSql())}
      ORDER BY s.roll ASC NULLS LAST
    `;
  }

  /** Fail-open wrapper around findParticipatingCandidatesInClass: returns
   * the participating-candidate roster for this exam+class when it's
   * non-empty, else falls back to the legacy "every active student in
   * class" roster (findActiveStudentsInClass) - so an exam that predates
   * ExamCandidate registration (zero rows) keeps behaving exactly as it did
   * before that feature existed, instead of suddenly reporting zero
   * required students / trivially "complete". This is the single shared
   * completeness-scoping rule used by getMarkCompleteness (this module) and
   * result-workflow.repository.ts's findStudentsMissingMarkForBook - do not
   * re-derive this fallback elsewhere. */
  async findRequiredStudentsInClass(madrasaId: number, examId: number, classId: number) {
    const candidates = await this.findParticipatingCandidatesInClass(madrasaId, examId, classId);
    if (candidates.length) return candidates;
    return this.findActiveStudentsInClass(madrasaId, classId);
  }

  /** Reassigns roll numbers in a single transaction using a two-phase
   * update - first to unique negative placeholders, then to the final
   * values - so the (madrasaId, classId, academicYear, roll) unique
   * constraint is never transiently violated by two students swapping
   * numbers. */
  reassignRollsInTransaction(assignments: { studentId: number; roll: number }[]) {
    return prisma.$transaction([
      ...assignments.map(({ studentId }) =>
        prisma.student.update({ where: { id: studentId }, data: { roll: -studentId } }),
      ),
      ...assignments.map(({ studentId, roll }) =>
        prisma.student.update({ where: { id: studentId }, data: { roll } }),
      ),
    ]);
  }

  /** The single undo-slot snapshot for applyRollByRank - see
   * ResultPanelService.applyRollByRank/undoRollByRank. `null` clears it
   * (after a successful undo, or if a future caller wants to invalidate it
   * without performing one). */
  saveRollSnapshot(
    resultMasterId: number,
    madrasaId: number,
    snapshot: { studentId: number; roll: number | null }[] | null,
  ) {
    return prisma.resultMaster.updateMany({
      where: { id: resultMasterId, madrasaId },
      data: { previousRollSnapshot: snapshot === null ? Prisma.DbNull : snapshot },
    });
  }

  async findRollSnapshot(
    resultMasterId: number,
    madrasaId: number,
  ): Promise<{ studentId: number; roll: number | null }[] | null> {
    const row = await prisma.resultMaster.findFirst({
      where: { id: resultMasterId, madrasaId },
      select: { previousRollSnapshot: true },
    });
    return (row?.previousRollSnapshot as { studentId: number; roll: number | null }[] | null) ?? null;
  }

  /** Rebuilds ResultSummary and, in the same transaction, writes
   * `status` onto ResultMaster - defaulting to "DRAFT" (the original
   * behavior every existing caller still relies on: a fresh/re-run process
   * always lands back in draft for review). `reprocessResultMaster` (the
   * correction-workflow reprocess) is the one caller that passes the
   * session's CURRENT status back in instead, so re-grading after an
   * approved correction doesn't silently rewind a PUBLISHED/LOCKED result
   * to DRAFT. */
  saveResultSummaryInTransaction(
    resultMasterId: number,
    summaryData: Prisma.ResultSummaryCreateManyInput[],
    status: ResultPublishStatus = "DRAFT",
  ) {
    return prisma.$transaction([
      prisma.resultSummary.deleteMany({ where: { resultMasterId } }),
      prisma.resultSummary.createMany({ data: summaryData }),
      prisma.resultMaster.update({ where: { id: resultMasterId }, data: { status } }),
    ]);
  }

  clearResultSummaryAndMarkDraft(resultMasterId: number) {
    return prisma.$transaction([
      prisma.resultSummary.deleteMany({ where: { resultMasterId } }),
      prisma.resultMaster.update({ where: { id: resultMasterId }, data: { status: "DRAFT" } }),
    ]);
  }

  findClassStatus(madrasaId: number, examId: number, divisionId: number) {
    return prisma.$queryRaw<ClassStatusRow[]>`
      SELECT
        c.id AS class_id,
        c.name_bn AS class_name_bn,
        rm.id AS result_master_id,
        rm.status AS publish_status,
        (SELECT COUNT(*) FROM students st
           WHERE st.madrasa_id = ${madrasaId} AND st.class_id = c.id AND st.division_id = ${divisionId}
             AND st.deleted_at IS NULL AND st.is_active = 1 AND st.admission_status = 'APPROVED'
        ) AS total_students,
        (SELECT COUNT(DISTINCT m.student_id) FROM marks m
           WHERE m.result_master_id = rm.id
        ) AS entered_students
      FROM madrasa_classes mc
      JOIN classes c ON c.id = mc.class_id
      LEFT JOIN results_master rm
        ON rm.class_id = c.id AND rm.exam_id = ${examId} AND rm.madrasa_id = ${madrasaId}
        AND rm.deleted_at IS NULL
      WHERE mc.madrasa_id = ${madrasaId} AND c.division_id = ${divisionId} AND mc.is_active = 1
      ORDER BY c.id ASC
    `;
  }

  findActiveDivisions(madrasaId: number) {
    return prisma.madrasaDivision.findMany({
      where: { madrasaId, isActive: 1 },
      select: { division: { select: { id: true, nameBn: true } } },
      orderBy: { division: { id: "asc" } },
    });
  }

  findExams(madrasaId: number) {
    return prisma.exam.findMany({
      where: { madrasaId, deletedAt: null, isActive: true },
      select: { id: true, name: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
  }

  findActiveClasses(madrasaId: number) {
    return prisma.madrasaClass.findMany({
      where: { madrasaId, isActive: 1 },
      select: { class: { select: { id: true, nameBn: true, divisionId: true } } },
      orderBy: [{ class: { divisionId: "asc" } }, { class: { id: "asc" } }],
    });
  }

  // NOTE: entered_students counts distinct Mark rows, not ResultSummary -
  // ResultSummary only gets rows once a session is actually PROCESSED, so
  // sourcing this progress indicator from it made every class show "এন্ট্রি
  // হয়নি" (not entered) throughout the entire marks-entry phase, even with
  // marks freshly saved - process is a separate, later step (see
  // processResult), not a precondition for "has this student been entered".
  findOverviewStatuses(madrasaId: number) {
    return prisma.$queryRaw<OverviewStatusRow[]>`
      SELECT
        c.id AS class_id,
        c.division_id,
        e.id AS exam_id,
        rm.id AS result_master_id,
        rm.status AS publish_status,
        (SELECT COUNT(*) FROM students st
           WHERE st.madrasa_id = ${madrasaId} AND st.class_id = c.id AND st.deleted_at IS NULL
             AND st.is_active = 1 AND st.admission_status = 'APPROVED'
        ) AS total_students,
        (SELECT COUNT(DISTINCT m.student_id) FROM marks m
           WHERE m.result_master_id = rm.id
        ) AS entered_students
      FROM madrasa_classes mc
      JOIN classes c ON c.id = mc.class_id
      JOIN exams e ON e.madrasa_id = ${madrasaId} AND e.deleted_at IS NULL
      LEFT JOIN results_master rm
        ON rm.class_id = c.id AND rm.exam_id = e.id AND rm.madrasa_id = ${madrasaId}
        AND rm.deleted_at IS NULL
      WHERE mc.madrasa_id = ${madrasaId} AND mc.is_active = 1
    `;
  }

  findResultSummaries(madrasaId: number, examId: number, classId: number) {
    return prisma.resultSummary.findMany({
      where: {
        resultMaster: { madrasaId, examId, classId, deletedAt: null },
        student: { deletedAt: null },
      },
      select: {
        resultMasterId: true,
        studentId: true,
        total: true,
        average: true,
        generalGrade: true,
        madrasaGrade: true,
        status: true,
        rankNo: true,
        resultMaster: { select: { status: true, previousRollSnapshot: true } },
        student: { select: { nameBn: true } },
      },
      orderBy: [{ rankNo: "asc" }, { studentId: "asc" }],
    });
  }

  findResultSummaryExists(resultMasterId: number) {
    return prisma.resultSummary.findFirst({ where: { resultMasterId }, select: { id: true } });
  }

  /* ================= DASHBOARD SUMMARY ================= */

  countActiveExams(madrasaId: number) {
    return prisma.exam.count({ where: { madrasaId, deletedAt: null, isActive: true } });
  }

  /** Every Exam row for the tenant regardless of isActive - the তালিমাত
   * dashboard's "মোট পরীক্ষা" stat needs the true total, while
   * countActiveExams() above stays scoped to active exams only. */
  countAllExams(madrasaId: number) {
    return prisma.exam.count({ where: { madrasaId, deletedAt: null } });
  }

  /** Every exam (active and inactive) for the তালিমাত dashboard's exam-status
   * table - unlike findExams() (used for the marks-entry filters, active
   * only), this intentionally includes inactive/archived exams so a past
   * exam still shows up with its final "completed" status instead of just
   * disappearing. */
  findAllExamsForStatus(madrasaId: number) {
    return prisma.exam.findMany({
      where: { madrasaId, deletedAt: null },
      select: { id: true, name: true, year: true, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
  }

  /** Min/max ExamRoutine.examDate per exam, used to classify each exam as
   * upcoming/ongoing/completed on the তালিমাত dashboard. An exam with no
   * routine rows simply has no entry in the returned array - the caller
   * treats that as "no schedule yet" rather than an error. */
  findExamRoutineDateRangeByExam(madrasaId: number) {
    return prisma.examRoutine.groupBy({
      by: ["examId"],
      where: { madrasaId },
      _min: { examDate: true },
      _max: { examDate: true },
    });
  }

  /** Most recent active exam (by year, then sort order) - the তালিমাত
   * dashboard's headline stats (pass/fail, average, grade distribution) are
   * scoped to this exam rather than every exam ever created. */
  findLatestActiveExam(madrasaId: number) {
    return prisma.exam.findFirst({
      where: { madrasaId, deletedAt: null, isActive: true },
      orderBy: [{ year: "desc" }, { sortOrder: "desc" }, { id: "desc" }],
      select: { id: true, name: true, year: true },
    });
  }

  countResultMastersByStatus(madrasaId: number) {
    return prisma.resultMaster.groupBy({
      by: ["status"],
      where: { madrasaId, deletedAt: null },
      _count: { _all: true },
    });
  }

  groupResultStatusForExam(madrasaId: number, examId: number) {
    return prisma.resultSummary.groupBy({
      by: ["status"],
      where: { resultMaster: { madrasaId, examId, deletedAt: null } },
      _count: { _all: true },
    });
  }

  groupGeneralGradeForExam(madrasaId: number, examId: number) {
    return prisma.resultSummary.groupBy({
      by: ["generalGrade"],
      where: { resultMaster: { madrasaId, examId, deletedAt: null }, generalGrade: { not: null } },
      _count: { _all: true },
    });
  }

  aggregateAverageForExam(madrasaId: number, examId: number) {
    return prisma.resultSummary.aggregate({
      where: { resultMaster: { madrasaId, examId, deletedAt: null } },
      _avg: { average: true },
      _count: { _all: true },
    });
  }

  /** Every exam summary row for one student across every result session
   * (draft and published) for this tenant, newest exam first - powers
   * Student 360's academic tab (admin view; guardians only ever see
   * PUBLISHED rows via GuardianRepository.findPublishedResultsForStudent). */
  findByStudent(madrasaId: number, studentId: number) {
    return prisma.resultSummary.findMany({
      where: {
        studentId,
        resultMaster: { madrasaId, deletedAt: null },
      },
      include: {
        resultMaster: {
          select: {
            status: true,
            exam: { select: { name: true } },
            class: { select: { nameBn: true, name: true } },
          },
        },
      },
      orderBy: { resultMaster: { createdAt: "desc" } },
    });
  }

  /** Every active subject assigned to a class, regardless of whether any
   * student has a mark recorded for it yet. Used to build the full subject
   * list for the "edit a single student's marks" modal — deriving the
   * subject list only from already-saved marks (as getFullResultView used
   * to do) hid any subject with zero entries so far, which made a newly
   * added/renamed subject impossible to enter marks for from that modal. */
  findActiveSubjectsForClass(
    madrasaId: number,
    classId: number,
  ): Promise<
    {
      isMiyari: boolean;
      fullMark: number;
      passMark: number | null;
      book: { id: number; nameBn: string | null; name: string | null } | null;
    }[]
  > {
    return prisma.madrasaBook.findMany({
      where: { madrasaId, isActive: 1, book: { classId } },
      select: {
        isMiyari: true,
        fullMark: true,
        passMark: true,
        book: { select: { id: true, nameBn: true, name: true } },
      },
      orderBy: { book: { id: "asc" } },
    });
  }

  /** Each miyari (must-pass-individually) subject can have its own pass
   * threshold (subjects with a smaller fullMark, e.g. 50, commonly pass at
   * 20 or 25 rather than the madrasa's global fail mark). `bookPassMarks`
   * maps bookId -> the effective threshold already resolved by the service
   * (subject's own passMark, or the global fail mark as fallback). A mark
   * strictly below its subject's threshold fails that subject. */
  async findStudentsFailingMiyariSubjects(
    madrasaId: number,
    examId: number,
    classId: number,
    resultMasterId: number,
    bookPassMarks: Map<number, number>,
  ) {
    if (!bookPassMarks.size) return [] as { studentId: number }[];

    const rows = await prisma.mark.findMany({
      where: {
        madrasaId,
        examId,
        classId,
        resultMasterId,
        bookId: { in: Array.from(bookPassMarks.keys()) },
        student: {
          madrasaId,
          classId,
          deletedAt: null,
          isActive: 1,
        },
      },
      select: { studentId: true, bookId: true, mark: true },
    });

    const failingStudentIds = new Set<number>();
    for (const row of rows) {
      const threshold = bookPassMarks.get(row.bookId);
      if (threshold !== undefined && Number(row.mark) < threshold) {
        failingStudentIds.add(row.studentId);
      }
    }

    return Array.from(failingStudentIds, (studentId) => ({ studentId }));
  }

  findFullResultSummaries(madrasaId: number, resultMasterId: number) {
    return prisma.resultSummary.findMany({
      where: {
        resultMasterId,
        resultMaster: { madrasaId, deletedAt: null },
        student: { deletedAt: null },
      },
      select: {
        resultMasterId: true,
        total: true,
        average: true,
        generalGrade: true,
        madrasaGrade: true,
        status: true,
        rankNo: true,
        resultMaster: { select: { status: true } },
        student: {
          select: {
            id: true,
            nameBn: true,
            registrationNo: true,
            marks: {
              where: {
                resultMasterId,
                book: {
                  madrasaBooks: {
                    some: { madrasaId, isActive: 1 },
                  },
                },
              },
              select: {
                bookId: true,
                mark: true,
                isAbsent: true,
                book: { select: { nameBn: true, name: true } },
              },
              orderBy: { bookId: "asc" },
            },
          },
        },
      },
      orderBy: [{ student: { registrationNo: "asc" } }],
    });
  }
}

export const resultPanelRepository = new ResultPanelRepository();
