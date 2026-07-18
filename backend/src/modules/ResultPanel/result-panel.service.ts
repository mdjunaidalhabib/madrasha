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
import {
  MarkRowDto,
  ProcessResultRequestDto,
  SaveMarksRequestDto,
} from "./result-panel.dto";

const toNumber = (value: any, fallback = 0) => {
  const n = Number(value);
  return Number.isNaN(n) ? fallback : n;
};

const getGradeFast = (avg: number, gradeList: GradeRow[], fallback: string) => {
  for (const g of gradeList) {
    if (avg >= Number(g.minMark) && avg <= Number(g.maxMark)) {
      return g.name;
    }
  }
  return fallback;
};

/**
 * NOTE (pre-existing behavior, preserved as-is): grade/fail-mark lookups
 * are cached in module-level variables rather than passed through the
 * call chain, exactly like the original controller. In a multi-tenant
 * process this means two concurrent `processResult` calls for different
 * madrasas could race and briefly read each other's cached grade list.
 * Not fixed here since it's a behavior change outside this refactor's
 * scope - flagged in the migration report as technical debt.
 */
let generalGradeCache: GradeRow[] = [];
let madrasaGradeCache: GradeRow[] = [];
let failMarkCache = DEFAULT_FAIL_MARK;

export class ResultPanelService {
  constructor(private readonly repository: ResultPanelRepository = resultPanelRepository) {}

  private async loadSettings(madrasaId: number) {
    const rows = await this.repository.findSettings(madrasaId);
    const fail = rows.find((r) => r.name === FAIL_MARK_SETTING_NAME);
    failMarkCache = fail ? Number(fail.value) : DEFAULT_FAIL_MARK;
  }

  private async loadGrades(madrasaId: number) {
    generalGradeCache = await this.repository.findGeneralGrades(madrasaId);
    madrasaGradeCache = await this.repository.findMadrasaGrades(madrasaId);
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
      return { message: "Session already exists", result_master_id: existing.id, status: existing.status };
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

    // NOTE: original code did one bulk `INSERT ... ON DUPLICATE KEY UPDATE`.
    // Prisma has no native bulk-upsert, so this is N upserts inside a
    // single transaction against the (resultMasterId, studentId, classId,
    // bookId) unique constraint - same end result, one round trip per row
    // instead of one round trip total.
    await this.repository.upsertMarksInTransaction(
      data.map((m) => ({
        where: {
          uniq_mark: {
            resultMasterId,
            studentId: toNumber(m.student_id),
            classId: toNumber(m.class_id),
            bookId: toNumber(m.book_id),
          },
        },
        update: { mark: toNumber(m.mark), examId: toNumber(m.exam_id) },
        create: {
          resultMasterId,
          studentId: toNumber(m.student_id),
          examId: toNumber(m.exam_id),
          classId: toNumber(m.class_id),
          bookId: toNumber(m.book_id),
          mark: toNumber(m.mark),
          madrasaId,
        },
      })) as any,
    );

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
    return { result_master_id, data: rows };
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

    await this.loadGrades(madrasaId);
    await this.loadSettings(madrasaId);

    // COUNT(DISTINCT book_id) in the original === count of matching rows,
    // since (result_master_id, student_id, class_id, book_id) is unique -
    // so a plain grouped row count is equivalent here.
    const marks = await this.repository.groupMarksByStudent(madrasaId, exam_id, class_id, result_master_id);

    if (!marks.length) {
      throw new BadRequestError("No marks found to process");
    }

    const sorted = [...marks].sort((a, b) => Number(b._sum.mark || 0) - Number(a._sum.mark || 0));

    const studentIds = sorted.map((r) => Number(r.studentId));
    const students = await this.repository.findRollsByStudentIds(studentIds);
    const rollByStudentId = new Map(students.map((s) => [s.id, s.roll ?? null]));

    const finalResultMasterId = result_master_id;
    const summaryData = sorted.map((r, i) => {
      const total = Number(r._sum.mark || 0);
      const cnt = r._count._all || 0;
      const avg = cnt > 0 ? total / cnt : 0;

      const general_grade = getGradeFast(avg, generalGradeCache, DEFAULT_GENERAL_GRADE_FALLBACK);
      const madrasa_grade = getGradeFast(avg, madrasaGradeCache, DEFAULT_MADRASA_GRADE_FALLBACK);
      const status = avg >= failMarkCache ? MARK_STATUS.PASS : MARK_STATUS.FAIL;

      return {
        resultMasterId: finalResultMasterId,
        studentId: Number(r.studentId),
        total,
        average: avg,
        generalGrade: general_grade,
        madrasaGrade: madrasa_grade,
        status,
        rankNo: i + 1,
        roll: rollByStudentId.get(Number(r.studentId)) ?? null,
      };
    });

    await this.repository.saveResultSummaryInTransaction(result_master_id, summaryData);

    return { message: "Result processed successfully", result_master_id };
  }

  async getClassStatus(madrasaId: number, examId: number, divisionId: number) {
    if (!examId || !divisionId) {
      throw new BadRequestError("exam_id and division_id are required");
    }
    return this.repository.findClassStatus(madrasaId, examId, divisionId);
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

    const statuses = await this.repository.findOverviewStatuses(madrasaId);

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

    await this.repository.deleteResultInTransaction(id);

    return { message: "Result deleted successfully" };
  }

  async getFullResultView(madrasaId: number, examId: number, classId: number, resultMasterIdInput: number) {
    let result_master_id = resultMasterIdInput;

    if (!result_master_id) {
      if (!examId || !classId) {
        throw new BadRequestError("result_master_id or exam_id + class_id is required");
      }

      const master = await this.repository.findLatestResultMasterId(madrasaId, examId, classId);
      if (!master) throw new NotFoundError("Result session not found");

      result_master_id = master.id;
    }

    const summaries = await this.repository.findFullResultSummaries(madrasaId, result_master_id);

    const booksMap = new Map<number, { book_id: number; book_name: string }>();
    const students = summaries.map((row) => {
      const marks = row.student.marks.map((m) => {
        const bookName = m.book.nameBn || m.book.name || `Book ${m.bookId}`;
        if (!booksMap.has(m.bookId)) {
          booksMap.set(m.bookId, { book_id: m.bookId, book_name: bookName });
        }
        return { book_id: m.bookId, book_name: bookName, mark: Number(m.mark || 0) };
      });

      return {
        result_master_id: row.resultMasterId,
        student_id: row.student.id,
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
