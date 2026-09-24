import { Prisma } from "@prisma/client";
import { BadRequestError, ConflictError, NotFoundError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import { sessionRepository, SessionRepository } from "../session/session.repository";
import { examFeeRepository, ExamFeeRepository } from "./exam-fee.repository";
import { feeService } from "./fee.service";

type ExamRow = Awaited<ReturnType<ExamFeeRepository["findExams"]>>[number];
type FeeRow = Awaited<ReturnType<ExamFeeRepository["findExamFeeRows"]>>[number];
type ClassRow = Awaited<ReturnType<ExamFeeRepository["findActiveClasses"]>>[number];

export interface ExamFeeAmountInput {
  class_id: number | string;
  /** null / 0 / "" = remove this class's fee for the exam. */
  amount: number | string | null;
}

/** An exam with no বিভাগ rows is held for every division. */
const examCoversDivision = (exam: ExamRow, divisionId: number) =>
  exam.divisions.length === 0 || exam.divisions.some((d) => d.divisionId === divisionId);

/** Whether this exam's fee has been switched on. Once rows exist their own
 * state is the truth (activateExamFee flips them all together); an exam with
 * no rows yet follows the exam itself, so a class added to an already-running
 * exam is billed straight away rather than sitting dormant. */
const isFeeLive = (exam: ExamRow, rows: FeeRow[]) =>
  rows.length ? rows.some((r) => r.isActive) : exam.isActive;

const parseAmount = (value: ExamFeeAmountInput["amount"]): number | null => {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw new BadRequestError("ফি-এর পরিমাণ সঠিক নয়");
  return amount === 0 ? null : Math.round(amount * 100) / 100;
};

/**
 * পরীক্ষার ফি, kept dynamic: every exam carries one FeeStructure per class it
 * is held for (its বিভাগ scope), so ফি সেটাপ is a live "exam × class" table
 * instead of rows an admin has to hand-link.
 *
 *  - syncExam() is called whenever an exam is created or its বিভাগ scope
 *    changes: classes that fall out of scope lose their row (or, if already
 *    billed, have it switched off), newly covered classes get one with a
 *    sensible default amount.
 *  - setAmounts() backs the ফি সেটাপ table edits.
 *
 * Billing itself stays in FeeService; FeeRepository.findActiveStructuresForBilling
 * additionally refuses exam-linked rows for a class outside the exam's scope.
 */
export class ExamFeeService {
  constructor(
    private readonly repository: ExamFeeRepository = examFeeRepository,
    private readonly sessions: SessionRepository = sessionRepository,
  ) {}

  /** The ফি সেটাপ "পরীক্ষার ফি" table: each exam with one cell per class it covers. */
  async getOverview(madrasaId: number) {
    const [exams, classes, rows] = await Promise.all([
      this.repository.findExams(madrasaId),
      this.repository.findActiveClasses(madrasaId),
      this.repository.findExamFeeRows(madrasaId),
    ]);

    return {
      classes: classes.map((c) => ({
        class_id: c.classId,
        class_name_bn: c.className,
        division_id: c.divisionId,
        division_name_bn: c.divisionName,
      })),
      exams: exams.map((exam) => {
        const examRows = rows.filter((r) => r.examId === exam.id);
        const byClass = new Map(examRows.filter((r) => r.classId !== null).map((r) => [r.classId as number, r]));
        const legacy = examRows.find((r) => r.classId === null);
        return {
          id: exam.id,
          name: exam.name,
          year: exam.year,
          is_active: exam.isActive,
          fee_active: isFeeLive(exam, examRows),
          division_ids: exam.divisions.map((d) => d.divisionId),
          // Pre-dynamic "every class" row that was already billed, so it
          // could not be split per class - shown read-only in the table.
          legacy_all_classes_amount: legacy ? Number(legacy.amount) : null,
          cells: classes
            .filter((c) => examCoversDivision(exam, c.divisionId))
            .map((c) => {
              const row = byClass.get(c.classId);
              return {
                class_id: c.classId,
                structure_id: row?.id ?? null,
                amount: row ? Number(row.amount) : null,
                is_active: row?.isActive ?? false,
                invoice_count: row?._count.invoices ?? 0,
              };
            }),
        };
      }),
    };
  }

  /** Sets / clears one exam's fee for any number of classes in one go. The
   * whole batch is validated before anything is written. New rows follow the
   * exam's fee state; if that fee is already live their students are billed
   * immediately. */
  async setAmounts(madrasaId: number, examId: number, items: ExamFeeAmountInput[]) {
    if (!Array.isArray(items) || items.length === 0) throw new BadRequestError("amounts is required");

    const [exam] = await this.repository.findExams(madrasaId, examId);
    if (!exam) throw new NotFoundError("Exam not found");

    // A pre-dynamic "every class" row must be split first (or, if already
    // billed, blocks per-class amounts - they would double-bill).
    let rows = await this.repository.findExamFeeRows(madrasaId, examId);
    const legacy = rows.find((r) => r.classId === null);
    if (legacy && legacy._count.invoices > 0) {
      throw new ConflictError(
        "এই পরীক্ষার পুরনো 'সব শ্রেণির জন্য' ফি থেকে ইতিমধ্যে ইনভয়েস তৈরি হয়েছে — শ্রেণিভিত্তিক ফি বসানো যাবে না",
      );
    }
    if (legacy) {
      await this.syncExam(madrasaId, examId);
      rows = await this.repository.findExamFeeRows(madrasaId, examId);
    }

    const classes = await this.repository.findActiveClasses(madrasaId);
    const classById = new Map(classes.map((c) => [c.classId, c]));
    const live = isFeeLive(exam, rows);

    const plan = items.map((item) => {
      const cls = classById.get(Number(item.class_id));
      if (!cls) throw new BadRequestError("নির্বাচিত শ্রেণিটি সক্রিয় নেই");
      if (!examCoversDivision(exam, cls.divisionId)) {
        throw new BadRequestError(`"${exam.name}" পরীক্ষাটি ${cls.className ?? "এই"} শ্রেণির বিভাগের জন্য নির্ধারিত নয়`);
      }
      const amount = parseAmount(item.amount);
      const row = rows.find((r) => r.classId === cls.classId);
      if (amount === null && row && row._count.invoices > 0) {
        throw new ConflictError(
          `${cls.className ?? "এই"} শ্রেণির জন্য এই পরীক্ষার ফি-এর ইনভয়েস তৈরি হয়ে গেছে — ফি মুছে ফেলা যাবে না`,
        );
      }
      return { cls, amount, row };
    });

    let created = 0;
    let updated = 0;
    let removed = 0;
    const billScopes: { classId: number; sessionId: number }[] = [];

    for (const { cls, amount, row } of plan) {
      if (amount === null) {
        if (row) {
          await this.repository.deleteRow(row.id, madrasaId);
          removed += 1;
        }
        continue;
      }
      if (row) {
        await this.repository.updateRow(row.id, madrasaId, { amount });
        updated += 1;
        continue;
      }
      const newRow = await this.createRowForClass(madrasaId, exam, cls, amount, live);
      created += 1;
      if (live) billScopes.push({ classId: cls.classId, sessionId: newRow.sessionId });
    }

    const invoicesCreated = await this.bill(madrasaId, billScopes);
    return { created, updated, removed, invoicesCreated };
  }

  /** Brings one exam's পরীক্ষার ফি rows in line with its বিভাগ scope. Safe to
   * call any number of times; never throws for "nothing to do". */
  async syncExam(madrasaId: number, examId: number) {
    const [exam] = await this.repository.findExams(madrasaId, examId);
    if (!exam) return;

    const [classes, rows] = await Promise.all([
      this.repository.findActiveClasses(madrasaId),
      this.repository.findExamFeeRows(madrasaId, examId),
    ]);
    const live = isFeeLive(exam, rows);
    const targets = classes.filter((c) => examCoversDivision(exam, c.divisionId));
    const targetIds = new Set(targets.map((c) => c.classId));
    const activeClassIds = new Set(classes.map((c) => c.classId));
    const billScopes: { classId: number; sessionId: number }[] = [];

    // 1. Active classes no longer covered: drop the row, or just stop it
    //    billing if invoices already reference it (history is never
    //    deleted). Rows of a class that is merely switched off for the
    //    madrasa are left alone, so re-activating it keeps its amount.
    for (const row of rows) {
      if (row.classId === null || targetIds.has(row.classId) || !activeClassIds.has(row.classId)) continue;
      if (row._count.invoices > 0) {
        if (row.isActive) await this.repository.updateRow(row.id, madrasaId, { isActive: false });
      } else {
        await this.repository.deleteRow(row.id, madrasaId);
      }
    }

    // 2. A pre-dynamic "every class" row: unbilled -> split into per-class
    //    rows below (its amount becomes their default); already billed ->
    //    leave it alone, since per-class rows next to it would double-bill.
    //    The billing query still limits it to the exam's own divisions.
    const legacy = rows.find((r) => r.classId === null);
    let legacyAmount: Prisma.Decimal | null = null;
    if (legacy) {
      if (legacy._count.invoices > 0) return;
      legacyAmount = legacy.amount;
      await this.repository.deleteRow(legacy.id, madrasaId);
    }

    // 3. Covered classes: re-enable a row switched off by an earlier scope
    //    change, or create one with a default amount.
    for (const cls of targets) {
      const row = rows.find((r) => r.classId === cls.classId);
      if (row) {
        if (live && !row.isActive) {
          await this.repository.updateRow(row.id, madrasaId, { isActive: true });
          billScopes.push({ classId: cls.classId, sessionId: row.sessionId });
        }
        continue;
      }
      const amount = legacyAmount ?? (await this.defaultAmountFor(madrasaId, cls.classId));
      if (amount === null) continue;
      const newRow = await this.createRowForClass(madrasaId, exam, cls, amount, live);
      if (live) billScopes.push({ classId: cls.classId, sessionId: newRow.sessionId });
    }

    await this.bill(madrasaId, billScopes);
  }

  /** Re-syncs every exam - after a class is activated/deactivated for the madrasa. */
  async syncAllExams(madrasaId: number) {
    const exams = await this.repository.findExams(madrasaId);
    for (const exam of exams) {
      await this.syncExam(madrasaId, exam.id);
    }
  }

  /** Default for a class an exam newly covers: what that class paid for its
   * most recent exam, else the super-admin পরীক্ষার ফি template. null = no
   * sensible default, so the cell stays empty for the admin to fill. */
  private async defaultAmountFor(madrasaId: number, classId: number): Promise<Prisma.Decimal | null> {
    const latest = await this.repository.findLatestExamFeeAmount(madrasaId, classId);
    if (latest) return latest.amount;
    const template = await this.repository.findTemplateExamFeeAmount(classId);
    return template?.amount ?? null;
  }

  private async createRowForClass(
    madrasaId: number,
    exam: ExamRow,
    cls: ClassRow,
    amount: Prisma.Decimal | number,
    isActive: boolean,
  ) {
    // The class's own বিভাগ session if it has one, else the general one.
    const session = await this.sessions.findCurrentSession(madrasaId, cls.divisionId);
    if (!session) throw new BadRequestError("কোনো চলমান সেশন নেই — আগে সেশন সেটাপ করুন");
    return this.repository.createRow({
      madrasaId,
      examId: exam.id,
      classId: cls.classId,
      amount,
      isActive,
      sessionId: session.id,
      academicYear: session.name,
    });
  }

  /** Bills already-enrolled students for newly live rows. A billing hiccup
   * is logged, never thrown - the fee rows themselves are already saved. */
  private async bill(madrasaId: number, scopes: { classId: number; sessionId: number }[]) {
    let invoicesCreated = 0;
    const seen = new Set<string>();
    for (const scope of scopes) {
      const key = `${scope.classId}:${scope.sessionId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        const result = await feeService.backfillInvoicesForAllStudents(madrasaId, scope.classId, scope.sessionId);
        invoicesCreated += result.invoicesCreated;
      } catch (err) {
        logger.error("exam fee billing failed:", err);
      }
    }
    return invoicesCreated;
  }
}

export const examFeeService = new ExamFeeService();
