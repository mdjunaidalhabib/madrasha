import { BadRequestError, NotFoundError } from "../../shared/errors";
import { resultPanelRepository, ResultPanelRepository } from "./result-panel.repository";
import {
  DEFAULT_FAIL_MARK,
  DEFAULT_GENERAL_GRADE_FALLBACK,
  DEFAULT_MADRASA_GRADE_FALLBACK,
  FAIL_MARK_SETTING_NAME,
  RESULT_STATUS,
  MARK_STATUS,
} from "./result-panel.constants";
import { GradeRow } from "./result-panel.types";
import { MarkRowDto, ProcessResultRequestDto, SaveMarksRequestDto } from "./result-panel.dto";

const toNumber = (value: any, fallback = 0) => {
  const n = Number(value);
  return Number.isNaN(n) ? fallback : n;
};

const toBanglaDigits = (value: string | number) =>
  String(value).replace(/\d/g, (digit) => "০১২৩৪৫৬৭৮৯"[Number(digit)]);

const getGradeFast = (avg: number, gradeList: GradeRow[], fallback: string) => {
  // maxMark is stored as a whole number boundary (e.g. 79), but avg can be a
  // decimal (e.g. 79.50) from averaging subject marks. Comparing with a
  // strict `<= maxMark` leaves decimals between two integer bands (79 and 80)
  // matching nothing, so treat the upper bound as exclusive at maxMark + 1.
  for (const g of gradeList) {
    if (avg >= Number(g.minMark) && avg < Number(g.maxMark) + 1) {
      return g.name;
    }
  }
  return fallback;
};

interface ResultCalculationConfig {
  generalGrades: GradeRow[];
  madrasaGrades: GradeRow[];
  failMark: number;
}

export class ResultPanelService {
  constructor(private readonly repository: ResultPanelRepository = resultPanelRepository) {}

  private async loadCalculationConfig(madrasaId: number): Promise<ResultCalculationConfig> {
    const [settings, generalGrades, madrasaGrades] = await Promise.all([
      this.repository.findSettings(madrasaId),
      this.repository.findGeneralGrades(madrasaId),
      this.repository.findMadrasaGrades(madrasaId),
    ]);

    const fail = settings.find((row) => row.name === FAIL_MARK_SETTING_NAME);

    return {
      generalGrades,
      madrasaGrades,
      failMark: fail ? Number(fail.value) : DEFAULT_FAIL_MARK,
    };
  }

  private async getMarkCompleteness(
    madrasaId: number,
    examId: number,
    classId: number,
    resultMasterId: number,
  ) {
    const [subjects, students, groupedMarks] = await Promise.all([
      this.repository.findActiveSubjectsForClass(madrasaId, classId),
      this.repository.findActiveStudentsInClass(madrasaId, classId),
      this.repository.groupMarksByStudent(madrasaId, examId, classId, resultMasterId),
    ]);

    const subjectCount = subjects.filter((row) => row.book).length;
    if (subjectCount === 0) {
      throw new BadRequestError("এই শ্রেণিতে কোনো সক্রিয় বিষয় পাওয়া যায়নি");
    }

    const enteredCountByStudent = new Map(
      groupedMarks.map((row) => [Number(row.studentId), Number(row._count._all || 0)]),
    );

    const incompleteStudents = students
      .map((student) => {
        const enteredSubjects = Number(enteredCountByStudent.get(student.id) || 0);
        return {
          studentId: student.id,
          studentName: student.nameBn || `শিক্ষার্থী ${student.id}`,
          roll: student.roll,
          enteredSubjects,
          missingSubjects: Math.max(0, subjectCount - enteredSubjects),
        };
      })
      .filter((student) => student.missingSubjects > 0);

    return {
      subjectCount,
      studentCount: students.length,
      incompleteStudents,
      missingEntries: incompleteStudents.reduce(
        (sum, student) => sum + student.missingSubjects,
        0,
      ),
    };
  }

  private async assertAllMarksEntered(
    madrasaId: number,
    examId: number,
    classId: number,
    resultMasterId: number,
  ) {
    const completeness = await this.getMarkCompleteness(
      madrasaId,
      examId,
      classId,
      resultMasterId,
    );

    if (completeness.incompleteStudents.length > 0) {
      // Never keep or publish an old partial total after the subject list or
      // entered marks become incomplete. The result stays draft until every
      // active student's every active subject has an explicit mark.
      await this.repository.clearResultSummaryAndMarkDraft(resultMasterId);

      const examples = completeness.incompleteStudents
        .slice(0, 3)
        .map((student) =>
          `${student.studentName}${
            student.roll ? ` (রোল ${toBanglaDigits(student.roll)})` : ""
          }`,
        )
        .join(", ");
      const more =
        completeness.incompleteStudents.length > 3
          ? `সহ আরও ${toBanglaDigits(completeness.incompleteStudents.length - 3)} জন`
          : "";

      throw new BadRequestError(
        `${toBanglaDigits(completeness.incompleteStudents.length)} জন শিক্ষার্থীর মোট ${toBanglaDigits(completeness.missingEntries)}টি বিষয়ের নম্বর দেওয়া হয়নি। ${examples}${more ? ` ${more}` : ""}। সব বিষয়ের নম্বর দিন; অনুপস্থিত হলে ঘরে "-" লিখুন।`,
      );
    }

    return completeness;
  }

  private async rebuildResultSummary(
    madrasaId: number,
    examId: number,
    classId: number,
    resultMasterId: number,
    config: ResultCalculationConfig,
  ) {
    const [marks, activeSubjects, absentCounts] = await Promise.all([
      this.repository.groupMarksByStudent(madrasaId, examId, classId, resultMasterId),
      this.repository.findActiveSubjectsForClass(madrasaId, classId),
      this.repository.countAbsentMarksByStudent(madrasaId, examId, classId, resultMasterId),
    ]);

    if (!marks.length) {
      await this.repository.clearResultSummaryAndMarkDraft(resultMasterId);
      return false;
    }

    const absentCountByStudent = new Map(
      absentCounts.map((row) => [Number(row.studentId), Number(row._count._all || 0)]),
    );

    // Subjects can carry different full marks (e.g. one 100-mark subject
    // alongside several 50-mark subjects in the নাযেরা/হিফজ division), so the
    // average is the percentage of total marks earned out of total marks
    // possible - not a plain sum/count, which would silently assume every
    // subject is worth 100.
    const totalFullMarks = activeSubjects
      .filter((subject) => subject.book)
      .reduce((sum, subject) => sum + Number(subject.fullMark || 100), 0);

    // Each miyari subject fails a student individually if their mark is
    // below that subject's own pass mark — or, when the subject has no
    // override set, the madrasa's global fail mark. Without this per-subject
    // resolution, a 50-mark subject would incorrectly be checked against a
    // global fail mark tuned for 100-mark subjects (e.g. 35), effectively
    // demanding 70%.
    const miyariBookPassMarks = new Map<number, number>(
      activeSubjects
        .filter((subject) => subject.isMiyari && subject.book)
        .map((subject) => [
          Number(subject.book!.id),
          subject.passMark ?? config.failMark,
        ]),
    );
    const failedMiyariRows = await this.repository.findStudentsFailingMiyariSubjects(
      madrasaId,
      examId,
      classId,
      resultMasterId,
      miyariBookPassMarks,
    );
    const studentsFailingMiyari = new Set(
      failedMiyariRows.map((row) => Number(row.studentId)),
    );

    const sorted = [...marks].sort((a, b) => Number(b._sum.mark || 0) - Number(a._sum.mark || 0));

    const studentIds = sorted.map((row) => Number(row.studentId));
    const students = await this.repository.findRollsByStudentIds(studentIds);
    const rollByStudentId = new Map(students.map((student) => [student.id, student.roll ?? null]));

    // Absent students don't get a merit rank — rankNo counts only up through
    // students who actually sat the exam, so "১ম" always means the best
    // performing student who was present, not just first in sort order.
    let rankCounter = 0;

    const summaryData = sorted.map((row) => {
      const total = Number(row._sum.mark || 0);
      const subjectCount = row._count._all || 0;
      const rawAverage = totalFullMarks > 0 ? (total / totalFullMarks) * 100 : 0;
      // Keep exactly 2 decimal places so the stored value matches what's shown everywhere.
      const average = Math.round(rawAverage * 100) / 100;

      // A student absent in every subject gets no PASS/FAIL/grade at all —
      // one who's absent in only some subjects still gets graded normally,
      // with those subjects counted as 0 in the average (handled above by
      // `mark` already being 0 for absent rows).
      const absentSubjectCount = absentCountByStudent.get(Number(row.studentId)) || 0;
      const fullyAbsent = subjectCount > 0 && absentSubjectCount === subjectCount;

      const passed =
        !fullyAbsent &&
        average >= config.failMark &&
        !studentsFailingMiyari.has(Number(row.studentId));

      return {
        resultMasterId,
        studentId: Number(row.studentId),
        total,
        average,
        generalGrade: fullyAbsent
          ? null
          : passed
            ? getGradeFast(average, config.generalGrades, DEFAULT_GENERAL_GRADE_FALLBACK)
            : DEFAULT_GENERAL_GRADE_FALLBACK,
        madrasaGrade: fullyAbsent
          ? null
          : passed
            ? getGradeFast(average, config.madrasaGrades, DEFAULT_MADRASA_GRADE_FALLBACK)
            : DEFAULT_MADRASA_GRADE_FALLBACK,
        status: fullyAbsent ? MARK_STATUS.ABSENT : passed ? MARK_STATUS.PASS : MARK_STATUS.FAIL,
        rankNo: fullyAbsent ? null : ++rankCounter,
        roll: rollByStudentId.get(Number(row.studentId)) ?? null,
      };
    });

    await this.repository.saveResultSummaryInTransaction(resultMasterId, summaryData);
    return true;
  }

  async reprocessClassResults(madrasaId: number, classId: number) {
    if (!classId) return { updated: 0 };

    const masters = await this.repository.findResultMastersByClass(madrasaId, classId);
    if (!masters.length) return { updated: 0 };

    const config = await this.loadCalculationConfig(madrasaId);

    let updated = 0;
    let skipped = 0;

    for (const master of masters) {
      const completeness = await this.getMarkCompleteness(
        madrasaId,
        master.examId,
        master.classId,
        master.id,
      );

      if (completeness.incompleteStudents.length > 0) {
        await this.repository.clearResultSummaryAndMarkDraft(master.id);
        skipped += 1;
        continue;
      }

      await this.rebuildResultSummary(madrasaId, master.examId, master.classId, master.id, config);
      updated += 1;
    }

    return { updated, skipped };
  }

  private async getOrCreateSessionId(madrasaId: number, examId: number, classId: number) {
    const existing = await this.repository.findResultMaster(madrasaId, examId, classId);
    if (existing) return existing.id;

    const created = await this.repository.createResultMaster(madrasaId, examId, classId);
    return created.id;
  }

  async createSession(madrasaId: number, examId: number, classId: number) {
    if (!examId || !classId) {
      throw new BadRequestError("exam_id and class_id are required");
    }

    const existing = await this.repository.findResultMaster(madrasaId, examId, classId);
    if (existing) {
      return {
        message: "Session already exists",
        result_master_id: existing.id,
        status: existing.status,
      };
    }

    const created = await this.repository.createResultMaster(madrasaId, examId, classId);
    return { message: "Session created successfully", result_master_id: created.id };
  }

  async saveMarks(madrasaId: number, body: SaveMarksRequestDto) {
    const { data } = body;
    const result_master_id = body.result_master_id;

    if (!Array.isArray(data) || data.length === 0) {
      throw new BadRequestError("Marks data is required");
    }

    const first = data[0] || ({} as MarkRowDto);
    const exam_id = toNumber(first.exam_id);
    const class_id = toNumber(first.class_id);

    if (!exam_id || !class_id) {
      throw new BadRequestError("exam_id and class_id are required in marks data");
    }

    const resultMasterId = result_master_id
      ? Number(result_master_id)
      : await this.getOrCreateSessionId(madrasaId, exam_id, class_id);

    // A cleared cell arrives as mark: null/"" — that's a delete, not an
    // upsert-to-zero, so split the batch before writing.
    const isCleared = (m: MarkRowDto) => m.mark === null || m.mark === undefined || m.mark === "";
    const upsertRows = data.filter((m) => !isCleared(m));
    const deleteRows = data.filter(isCleared);

    // NOTE: original code did one bulk `INSERT ... ON DUPLICATE KEY UPDATE`.
    // Prisma has no native bulk-upsert, so this is N upserts inside a
    // single transaction against the (resultMasterId, studentId, classId,
    // bookId) unique constraint - same end result, one round trip per row
    // instead of one round trip total.
    if (upsertRows.length) {
      await this.repository.upsertMarksInTransaction(
        upsertRows.map((m) => ({
          where: {
            uniq_mark: {
              resultMasterId,
              studentId: toNumber(m.student_id),
              classId: toNumber(m.class_id),
              bookId: toNumber(m.book_id),
            },
          },
          update: {
            mark: toNumber(m.mark),
            examId: toNumber(m.exam_id),
            isAbsent: Boolean(m.is_absent),
          },
          create: {
            resultMasterId,
            studentId: toNumber(m.student_id),
            examId: toNumber(m.exam_id),
            classId: toNumber(m.class_id),
            bookId: toNumber(m.book_id),
            mark: toNumber(m.mark),
            isAbsent: Boolean(m.is_absent),
            madrasaId,
          },
        })),
      );
    }

    if (deleteRows.length) {
      await this.repository.deleteMarksInTransaction(
        resultMasterId,
        deleteRows.map((m) => ({
          studentId: toNumber(m.student_id) ?? 0,
          bookId: toNumber(m.book_id) ?? 0,
        })),
      );
    }

    return { message: "Marks saved successfully", result_master_id: resultMasterId };
  }

  async getMarks(madrasaId: number, examId: number, classId: number, resultMasterIdInput: number) {
    let result_master_id = resultMasterIdInput;

    if (!examId || !classId) {
      throw new BadRequestError("exam_id and class_id are required");
    }

    if (!result_master_id) {
      const master = await this.repository.findLatestResultMasterId(madrasaId, examId, classId);
      if (!master) {
        return { result_master_id: null, data: [] };
      }
      result_master_id = master.id;
    }

    const rows = await this.repository.findMarks(madrasaId, examId, classId, result_master_id);

    // Prisma returns model fields in camelCase, while the ResultPanel API and
    // marks-entry UI use snake_case. Returning raw rows made edit mode look
    // empty even though the saved marks existed in the database.
    const data = rows.map((row) => ({
      student_id: row.studentId,
      book_id: row.bookId,
      mark: Number(row.mark),
      is_absent: Boolean(row.isAbsent),
      result_master_id: row.resultMasterId,
    }));

    return { result_master_id, data };
  }

  async processResult(madrasaId: number, body: ProcessResultRequestDto) {
    const exam_id = toNumber(body.exam_id);
    const class_id = toNumber(body.class_id);
    let result_master_id = toNumber(body.result_master_id);

    if (!exam_id || !class_id) {
      throw new BadRequestError("exam_id and class_id are required");
    }

    if (!result_master_id) {
      const master = await this.repository.findLatestResultMasterId(madrasaId, exam_id, class_id);
      if (!master) throw new NotFoundError("Result session not found");
      result_master_id = master.id;
    }

    await this.assertAllMarksEntered(
      madrasaId,
      exam_id,
      class_id,
      result_master_id,
    );

    const config = await this.loadCalculationConfig(madrasaId);
    const processed = await this.rebuildResultSummary(
      madrasaId,
      exam_id,
      class_id,
      result_master_id,
      config,
    );

    if (!processed) {
      throw new BadRequestError("No marks found to process");
    }

    return { message: "Result processed successfully", result_master_id };
  }

  async getClassStatus(madrasaId: number, examId: number, divisionId: number) {
    if (!examId || !divisionId) {
      throw new BadRequestError("exam_id and division_id are required");
    }

    const rows = await this.repository.findClassStatus(madrasaId, examId, divisionId);

    // PostgreSQL COUNT(*) is returned as bigint by Prisma raw queries.
    // Express cannot JSON.stringify bigint values, so normalize the counts
    // before they reach res.json().
    return rows.map((row) => ({
      ...row,
      total_students: Number(row.total_students),
      entered_students: Number(row.entered_students),
    }));
  }

  async getResultOverview(madrasaId: number) {
    const divisionRows = await this.repository.findActiveDivisions(madrasaId);
    const divisions = divisionRows.map((r) => ({
      division_id: r.division.id,
      division_name_bn: r.division.nameBn,
    }));

    const examRows = await this.repository.findExams(madrasaId);

    const classRows = await this.repository.findActiveClasses(madrasaId);
    const classes = classRows.map((r) => ({
      class_id: r.class.id,
      class_name_bn: r.class.nameBn,
      division_id: r.class.divisionId,
    }));

    const statusRows = await this.repository.findOverviewStatuses(madrasaId);
    const statuses = statusRows.map((row) => ({
      ...row,
      total_students: Number(row.total_students),
      entered_students: Number(row.entered_students),
    }));

    return { divisions, exams: examRows, classes, statuses };
  }

  async getSummary(madrasaId: number, examId: number, classId: number) {
    if (!examId || !classId) {
      throw new BadRequestError("exam_id and class_id are required");
    }

    const rows = await this.repository.findResultSummaries(madrasaId, examId, classId);

    return rows.map((r) => ({
      result_master_id: r.resultMasterId,
      student_id: r.studentId,
      name_bn: r.student.nameBn,
      total: r.total,
      average: r.average,
      general_grade: r.generalGrade,
      madrasa_grade: r.madrasaGrade,
      status: r.status,
      rank_no: r.rankNo,
      publish_status: r.resultMaster.status,
    }));
  }

  async publishResult(madrasaId: number, resultMasterId: number) {
    if (!resultMasterId) {
      throw new BadRequestError("result_master_id is required");
    }

    const master = await this.repository.findResultMasterById(resultMasterId, madrasaId);
    if (!master) throw new NotFoundError("Result session not found");

    await this.assertAllMarksEntered(
      madrasaId,
      master.examId,
      master.classId,
      resultMasterId,
    );

    const summary = await this.repository.findResultSummaryExists(resultMasterId);
    if (!summary) throw new BadRequestError("Process result before publish");

    await this.repository.updateResultMasterStatus(resultMasterId, RESULT_STATUS.PUBLISHED);

    return { message: "Result published successfully" };
  }

  /**
   * Reassigns classroom roll numbers for a class based on this result's
   * merit order (rank 1 -> roll 1, rank 2 -> roll 2, ...). Students without
   * a mark entry for this exam (absent, etc.) are placed after the ranked
   * students, keeping their existing relative roll order, so nobody loses
   * their roll and no two students end up sharing one.
   *
   * This only updates the student's *current* roll (used going forward -
   * next exam, ID cards, class lists). It does NOT touch the roll already
   * snapshotted on this or any other result's ResultSummary rows, so
   * previously processed/published marksheets keep showing the roll each
   * student had at the time, unaffected by this reassignment.
   */
  async applyRollByRank(madrasaId: number, resultMasterId: number) {
    if (!resultMasterId) {
      throw new BadRequestError("result_master_id is required");
    }

    const master = await this.repository.findResultMasterById(resultMasterId, madrasaId);
    if (!master) throw new NotFoundError("Result session not found");

    const ranked = await this.repository.findRankedStudentsForResult(resultMasterId);
    if (!ranked.length) {
      throw new BadRequestError("Process result before reassigning roll by rank");
    }

    const roster = await this.repository.findActiveStudentsInClass(madrasaId, master.classId);

    const rankedIds = new Set(ranked.map((r) => r.studentId));
    const unranked = roster.filter((s) => !rankedIds.has(s.id));

    const orderedIds = [...ranked.map((r) => r.studentId), ...unranked.map((s) => s.id)];

    const assignments = orderedIds.map((studentId, index) => ({
      studentId,
      roll: index + 1,
    }));

    await this.repository.reassignRollsInTransaction(assignments);

    return { message: "Roll reassigned by result rank", updated: assignments.length };
  }

  async deleteResult(madrasaId: number, id: number) {
    if (!id) throw new BadRequestError("Invalid result id");

    const master = await this.repository.findResultMasterById(id, madrasaId);
    if (!master) throw new NotFoundError("Result session not found");

    // Soft-delete only — moves the result to Trash. Marks/summary rows are
    // preserved until it's permanently deleted from there (see
    // trash.repository.ts#permanentDeleteResult).
    await this.repository.softDeleteResultMaster(id, madrasaId);

    return { message: "Result moved to trash" };
  }

  async getFullResultView(
    madrasaId: number,
    examId: number,
    classId: number,
    resultMasterIdInput: number,
  ) {
    let result_master_id = resultMasterIdInput;

    if (!result_master_id) {
      if (!examId || !classId) {
        throw new BadRequestError("result_master_id or exam_id + class_id is required");
      }

      const master = await this.repository.findLatestResultMasterId(madrasaId, examId, classId);
      if (!master) throw new NotFoundError("Result session not found");

      result_master_id = master.id;
    }

    // The frontend's Preview page calls this endpoint with only
    // `result_master_id` (no exam_id/class_id), so `classId` here is often
    // 0. Resolve the real class from the result master so we can pull the
    // *full* subject list for the class below — not just the subjects that
    // happen to already have a mark saved.
    let resolvedClassId = classId;
    if (!resolvedClassId) {
      const master = await this.repository.findResultMasterById(result_master_id, madrasaId);
      resolvedClassId = master?.classId || 0;
    }

    const summaries = await this.repository.findFullResultSummaries(madrasaId, result_master_id);

    const booksMap = new Map<
      number,
      {
        book_id: number;
        book_name: string;
        is_miyari: boolean;
        full_marks: number;
        pass_mark: number | null;
      }
    >();

    // Seed with every subject currently assigned to the class, even ones
    // with zero marks entered so far. Previously this map was built only
    // from marks already saved in `summaries`, which meant a newly added
    // (or renamed) subject with no marks yet simply never appeared in the
    // "edit a single student" modal, so a teacher couldn't enter marks for
    // it from there.
    if (resolvedClassId) {
      const classSubjects = await this.repository.findActiveSubjectsForClass(
        madrasaId,
        resolvedClassId,
      );
      classSubjects.forEach(({ book, isMiyari, fullMark, passMark }) => {
        if (!book) return;
        booksMap.set(book.id, {
          book_id: book.id,
          book_name: book.nameBn || book.name || `Book ${book.id}`,
          is_miyari: isMiyari,
          full_marks: fullMark,
          // null here means "no override" — the frontend can fall back to
          // showing the madrasa's global fail mark for this subject.
          pass_mark: passMark,
        });
      });
    }

    const students = summaries.map((row) => {
      const marks = row.student.marks.map((m) => {
        const bookName = m.book.nameBn || m.book.name || `Book ${m.bookId}`;
        if (!booksMap.has(m.bookId)) {
          booksMap.set(m.bookId, {
            book_id: m.bookId,
            book_name: bookName,
            is_miyari: false,
            full_marks: 100,
            pass_mark: null,
          });
        }
        return {
          book_id: m.bookId,
          book_name: bookName,
          mark: Number(m.mark || 0),
          is_absent: Boolean(m.isAbsent),
        };
      });

      return {
        result_master_id: row.resultMasterId,
        student_id: row.student.id,
        registration_no: row.student.registrationNo,
        name_bn: row.student.nameBn,
        total: Number(row.total || 0),
        average: Number(row.average || 0),
        general_grade: row.generalGrade || "",
        madrasa_grade: row.madrasaGrade || "",
        status: row.status || "",
        rank_no: row.rankNo || 0,
        publish_status: row.resultMaster.status || RESULT_STATUS.DRAFT,
        marks,
      };
    });

    return {
      result_master_id,
      books: Array.from(booksMap.values()).sort((a, b) => a.book_id - b.book_id),
      students,
    };
  }
}

export const resultPanelService = new ResultPanelService();
