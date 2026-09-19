import { CorrectionStatus } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { BadRequestError, ConflictError, NotFoundError } from "../../shared/errors";
import { logActivity } from "../../shared/utils/activity.util";
import { hasExamDepartmentAuthority, hasFullResultAuthority } from "../../shared/utils/rbac.util";
import { resultPanelRepository } from "./result-panel.repository";
import { resultPanelService } from "./result-panel.service";

export interface CorrectionItemDto {
  student_id?: number | string;
  book_id?: number | string;
  field: string;
  new_value: string | number | boolean | null;
}

export interface RequestCorrectionDto extends CorrectionItemDto {
  reason: string;
}

export interface RequestCorrectionBatchDto {
  items: CorrectionItemDto[];
  reason: string;
  /** Apply immediately instead of leaving the requests PENDING. Honoured
   * only for an actor with full result authority (তালিমাত / Muhtamim /
   * Super Admin, or verify+approve holders) - everyone else's requests stay
   * PENDING for a separate approver, exactly as with the single endpoint. */
  apply_now?: boolean;
}

// Mark-level fields target one (resultMasterId, studentId, bookId) Mark row.
const MARK_FIELDS = new Set(["mark", "is_absent", "is_exempted", "is_withheld", "note"]);
const BOOLEAN_MARK_FIELDS = new Set(["is_absent", "is_exempted", "is_withheld"]);
// Summary-level fields target one (resultMasterId, studentId) ResultSummary row.
const SUMMARY_FIELDS = new Set([
  "general_grade",
  "madrasa_grade",
  "total",
  "average",
  "status",
  "rank_no",
]);

// The class-wide "সব নম্বর সংশোধন" screen can legitimately change a few
// thousand cells at once (roster x subjects, several fields per cell); this
// only exists to cap a pathological payload.
const MAX_BATCH_ITEMS = 3000;

type MarkLike = {
  mark: number;
  isAbsent: boolean;
  isExempted: boolean;
  isWithheld: boolean;
  note: string | null;
};

// Above this many rows in one call, activity logging is aggregated per batch.
const AUDIT_LOG_PER_ROW_LIMIT = 5;

const ALREADY_DECIDED_MESSAGE = "এই সংশোধনের অনুরোধ ইতিমধ্যে সিদ্ধান্ত নেওয়া হয়ে গেছে।";
const DUPLICATE_PENDING_MESSAGE =
  "এই একই বিষয়ের জন্য ইতিমধ্যে একটি সংশোধনের অনুরোধ অপেক্ষমাণ (PENDING) আছে — আগেরটি সিদ্ধান্ত না হওয়া পর্যন্ত নতুন অনুরোধ দেওয়া যাবে না।";

interface PreparedCorrection {
  field: string;
  studentId: number | null;
  bookId: number | null;
  oldValue: string | null;
  newValue: string | null;
}

/**
 * Controlled correction workflow for results that have already passed
 * publish (or lock) - see prisma/models/result.prisma's ResultCorrection
 * model doc comment. A correction is only ever *applied* after an explicit
 * approve decision (or an explicit apply_now by an actor with full result
 * authority); requesting one never touches the live Mark/ResultSummary row.
 */
export class ResultCorrectionService {
  private async assertMaster(madrasaId: number, resultMasterId: number) {
    const master = await resultPanelRepository.findResultMasterById(resultMasterId, madrasaId);
    if (!master) throw new NotFoundError("Result session not found");
    return master;
  }

  private assertCorrectable(status: string) {
    if (status !== "PUBLISHED" && status !== "LOCKED") {
      throw new ConflictError(
        "ফলাফল প্রকাশিত/লক অবস্থায় থাকলেই কেবল সংশোধনের অনুরোধ করা যায় — এখনো প্রকাশ না হলে সরাসরি নম্বর সম্পাদনা করুন।",
      );
    }
  }

  /** Validates one requested change against the live data and captures the
   * value it would overwrite. Everything that can be rejected up front IS
   * rejected here (including the new value's shape), so a bad request fails
   * at request time instead of half-way through an approve. */
  private async prepareCorrection(
    resultMasterId: number,
    item: CorrectionItemDto,
    fullMarkByBookId?: Map<number, number>,
    // Pre-loaded Mark rows keyed "studentId:bookId" - lets a big batch skip
    // one query per cell. Without it each mark is looked up individually.
    markCache?: Map<string, MarkLike>,
  ): Promise<PreparedCorrection> {
    const field = String(item.field || "");
    const studentId = item.student_id ? Number(item.student_id) : null;
    const bookId = item.book_id ? Number(item.book_id) : null;
    const newValue =
      item.new_value === null || item.new_value === undefined ? null : String(item.new_value);

    let oldValue: string | null;

    if (MARK_FIELDS.has(field)) {
      if (!studentId || !bookId) {
        throw new BadRequestError("mark-স্তরের সংশোধনের জন্য student_id ও book_id আবশ্যক।");
      }
      const mark = markCache
        ? (markCache.get(`${studentId}:${bookId}`) ?? null)
        : await prisma.mark.findFirst({ where: { resultMasterId, studentId, bookId } });
      if (!mark) throw new NotFoundError("এই শিক্ষার্থী/বিষয়ের নম্বরের কোনো রেকর্ড পাওয়া যায়নি।");
      oldValue = this.readMarkField(mark, field);

      if (field === "mark") {
        const n = Number(newValue);
        if (newValue === null || newValue.trim() === "" || !Number.isFinite(n) || n < 0) {
          throw new BadRequestError("নম্বরের মান সঠিক নয়।");
        }
        const fullMark = fullMarkByBookId?.get(bookId);
        if (fullMark !== undefined && n > fullMark) {
          throw new BadRequestError(`নম্বর পূর্ণমান (${fullMark}) এর বেশি হতে পারে না।`);
        }
      } else if (BOOLEAN_MARK_FIELDS.has(field) && newValue !== "true" && newValue !== "false") {
        throw new BadRequestError(`"${field}" এর মান true অথবা false হতে হবে।`);
      }
    } else if (SUMMARY_FIELDS.has(field)) {
      if (!studentId) {
        throw new BadRequestError("summary-স্তরের সংশোধনের জন্য student_id আবশ্যক।");
      }
      const summary = await prisma.resultSummary.findUnique({
        where: { resultMasterId_studentId: { resultMasterId, studentId } },
      });
      if (!summary) throw new NotFoundError("এই শিক্ষার্থীর ফলাফল সারাংশ পাওয়া যায়নি।");
      oldValue = this.readSummaryField(summary, field);
    } else {
      throw new BadRequestError(`"${field}" ক্ষেত্রটি সংশোধনযোগ্য নয়।`);
    }

    return { field, studentId, bookId, oldValue, newValue };
  }

  async requestCorrection(
    madrasaId: number,
    userId: number,
    resultMasterId: number,
    body: RequestCorrectionDto,
  ) {
    const master = await this.assertMaster(madrasaId, resultMasterId);
    this.assertCorrectable(master.status);

    const reason = String(body.reason || "").trim();
    if (!reason) throw new BadRequestError("সংশোধনের কারণ উল্লেখ করা আবশ্যক।");

    const subjects = await resultPanelRepository.findActiveSubjectsForClass(madrasaId, master.classId);
    const fullMarkByBookId = new Map<number, number>(
      subjects.filter((s) => s.book).map((s) => [s.book!.id, Number(s.fullMark || 100)]),
    );

    const prepared = await this.prepareCorrection(resultMasterId, body, fullMarkByBookId);

    let created;
    try {
      created = await prisma.resultCorrection.create({
        data: {
          madrasaId,
          resultMasterId,
          studentId: prepared.studentId,
          bookId: prepared.bookId,
          field: prepared.field,
          oldValue: prepared.oldValue,
          newValue: prepared.newValue,
          reason,
          status: "PENDING",
          requestedBy: userId,
        },
      });
    } catch (err: any) {
      // uniq_pending_result_correction (partial unique index, see the
      // result.prisma ResultCorrection doc-comment) blocks a second PENDING
      // request for the same (resultMasterId, studentId, bookId, field).
      if (err?.code === "P2002") throw new ConflictError(DUPLICATE_PENDING_MESSAGE);
      throw err;
    }

    await this.logRequested(madrasaId, userId, resultMasterId, created.id, prepared, reason);

    return { message: "সংশোধনের অনুরোধ জমা দেওয়া হয়েছে", correction_id: created.id };
  }

  /** Several changed cells of one report card in a single all-or-nothing
   * request - what the student edit screen actually sends. Creating them
   * together (and, for a full-authority actor, applying them together) means
   * the class is re-graded ONCE, not once per cell. */
  async requestCorrectionBatch(
    madrasaId: number,
    userId: number,
    resultMasterId: number,
    body: RequestCorrectionBatchDto,
  ) {
    const master = await this.assertMaster(madrasaId, resultMasterId);
    this.assertCorrectable(master.status);

    const reason = String(body.reason || "").trim();
    if (!reason) throw new BadRequestError("সংশোধনের কারণ উল্লেখ করা আবশ্যক।");

    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) throw new BadRequestError("কোনো সংশোধন দেওয়া হয়নি।");
    if (items.length > MAX_BATCH_ITEMS) {
      throw new BadRequestError(`একবারে সর্বোচ্চ ${MAX_BATCH_ITEMS}টি সংশোধন দেওয়া যাবে।`);
    }

    const seen = new Set<string>();
    for (const item of items) {
      const key = `${item.student_id ?? ""}:${item.book_id ?? ""}:${item.field}`;
      if (seen.has(key)) throw new BadRequestError("একই ঘরের একই ক্ষেত্র একাধিকবার দেওয়া হয়েছে।");
      seen.add(key);
    }

    const subjects = await resultPanelRepository.findActiveSubjectsForClass(madrasaId, master.classId);
    const fullMarkByBookId = new Map<number, number>(
      subjects.filter((s) => s.book).map((s) => [s.book!.id, Number(s.fullMark || 100)]),
    );

    const markRows = await prisma.mark.findMany({ where: { resultMasterId } });
    const markCache = new Map<string, MarkLike>(
      markRows.map((m) => [`${m.studentId}:${m.bookId}`, m]),
    );

    const prepared: PreparedCorrection[] = [];
    for (const item of items) {
      prepared.push(await this.prepareCorrection(resultMasterId, item, fullMarkByBookId, markCache));
    }

    // One multi-row INSERT (all-or-nothing) instead of one round trip per
    // cell. The shared requestedAt stamp lets us read back exactly the rows
    // this call created, since createMany doesn't return ids.
    const batchStamp = new Date();
    try {
      await prisma.resultCorrection.createMany({
        data: prepared.map((p) => ({
          madrasaId,
          resultMasterId,
          studentId: p.studentId,
          bookId: p.bookId,
          field: p.field,
          oldValue: p.oldValue,
          newValue: p.newValue,
          reason,
          status: "PENDING" as const,
          requestedBy: userId,
          requestedAt: batchStamp,
        })),
      });
    } catch (err: any) {
      if (err?.code === "P2002") throw new ConflictError(DUPLICATE_PENDING_MESSAGE);
      throw err;
    }
    const created = await prisma.resultCorrection.findMany({
      where: { madrasaId, resultMasterId, requestedBy: userId, requestedAt: batchStamp, status: "PENDING" },
      orderBy: { id: "asc" },
      select: { id: true },
    });

    if (created.length <= AUDIT_LOG_PER_ROW_LIMIT) {
      for (let i = 0; i < created.length; i += 1) {
        await this.logRequested(madrasaId, userId, resultMasterId, created[i].id, prepared[i], reason);
      }
    } else {
      // A class-wide edit would otherwise write thousands of near-identical
      // activity rows; every cell's old/new value, reason and requester is
      // already on its own ResultCorrection row, so log the batch once.
      await logActivity({
        madrasa_id: madrasaId,
        user_id: userId,
        action: "CREATE",
        entity: "results/corrections",
        entity_id: resultMasterId,
        details: JSON.stringify({ result_master_id: resultMasterId, count: created.length, reason }),
      });
    }

    const correctionIds = created.map((c) => c.id);
    let applied = false;
    if (body.apply_now && (await hasFullResultAuthority(userId))) {
      await this.applyCorrections(madrasaId, userId, correctionIds, null);
      applied = true;
    }

    return {
      message: applied ? "সংশোধন প্রয়োগ করা হয়েছে" : "সংশোধনের অনুরোধ জমা দেওয়া হয়েছে",
      correction_ids: correctionIds,
      applied,
    };
  }

  private async logRequested(
    madrasaId: number,
    userId: number,
    resultMasterId: number,
    correctionId: number,
    prepared: PreparedCorrection,
    reason: string,
  ) {
    await logActivity({
      madrasa_id: madrasaId,
      user_id: userId,
      action: "CREATE",
      entity: "results/corrections",
      entity_id: correctionId,
      details: JSON.stringify({
        result_master_id: resultMasterId,
        field: prepared.field,
        student_id: prepared.studentId,
        book_id: prepared.bookId,
        old_value: prepared.oldValue,
        new_value: prepared.newValue,
        reason,
      }),
    });
  }

  async listCorrections(madrasaId: number, resultMasterId: number) {
    await this.assertMaster(madrasaId, resultMasterId);

    const rows = await prisma.resultCorrection.findMany({
      where: { madrasaId, resultMasterId },
      orderBy: { id: "desc" },
    });

    return rows.map((r) => ({
      id: r.id,
      student_id: r.studentId,
      book_id: r.bookId,
      field: r.field,
      old_value: r.oldValue,
      new_value: r.newValue,
      reason: r.reason,
      status: r.status,
      requested_by: r.requestedBy,
      requested_at: r.requestedAt,
      decided_by: r.decidedBy,
      decided_at: r.decidedAt,
      decision_note: r.decisionNote,
      applied_at: r.appliedAt,
    }));
  }

  async decide(
    madrasaId: number,
    userId: number,
    correctionId: number,
    approve: boolean,
    decisionNote?: string,
  ) {
    if (!correctionId) throw new BadRequestError("correction id is required");

    const correction = await prisma.resultCorrection.findFirst({
      where: { id: correctionId, madrasaId },
    });
    if (!correction) throw new NotFoundError("সংশোধনের অনুরোধ পাওয়া যায়নি।");
    if (correction.status !== ("PENDING" as CorrectionStatus)) {
      throw new ConflictError(ALREADY_DECIDED_MESSAGE);
    }

    if (correction.requestedBy === userId && !(await hasExamDepartmentAuthority(userId))) {
      throw new ConflictError(
        "নিজের অনুরোধ করা সংশোধন নিজে অনুমোদন/প্রত্যাখ্যান করা যাবে না — ভিন্ন ব্যবহারকারীর সিদ্ধান্ত প্রয়োজন।",
      );
    }

    if (!approve) {
      // Guarded on status: "PENDING" so two concurrent decide() calls on
      // the same request can't both apply - only the first write matches.
      const rejected = await prisma.resultCorrection.updateMany({
        where: { id: correctionId, status: "PENDING" },
        data: {
          status: "REJECTED",
          decidedBy: userId,
          decidedAt: new Date(),
          decisionNote: decisionNote?.trim() || null,
        },
      });
      if (rejected.count === 0) throw new ConflictError(ALREADY_DECIDED_MESSAGE);

      await logActivity({
        madrasa_id: madrasaId,
        user_id: userId,
        action: "REJECT",
        entity: "results/corrections",
        entity_id: correctionId,
        details: decisionNote?.trim() || null,
      });

      return { message: "সংশোধনের অনুরোধ প্রত্যাখ্যান করা হয়েছে" };
    }

    await this.applyCorrections(madrasaId, userId, [correctionId], decisionNote?.trim() || null);
    return { message: "সংশোধন প্রয়োগ করা হয়েছে" };
  }

  /** Approves and applies PENDING corrections of ONE result session.
   *
   * The rows are atomically claimed first (one UPDATE guarded on status
   * PENDING, using APPROVED as the transient "claimed, applying now"
   * marker) BEFORE any live data is touched, so two concurrent approvals
   * can't double-apply. Then all field writes and the APPLIED flip commit in
   * a single transaction. If anything fails, the claimed rows are released
   * back to PENDING (they used to be stranded in APPROVED forever) and no
   * live data has changed.
   *
   * The class is re-graded once for the whole batch - through the SAME
   * grading engine processResult uses, never a second copy - and one
   * CORRECTION snapshot is written (audit/integrity record only, like
   * publish; not wired into any read path yet). */
  private async applyCorrections(
    madrasaId: number,
    userId: number,
    correctionIds: number[],
    decisionNote: string | null,
  ) {
    const rows = await prisma.resultCorrection.findMany({
      where: { id: { in: correctionIds }, madrasaId },
      orderBy: { id: "asc" },
    });
    if (rows.length !== correctionIds.length) {
      throw new NotFoundError("সংশোধনের অনুরোধ পাওয়া যায়নি।");
    }
    const resultMasterId = rows[0].resultMasterId;
    if (rows.some((r) => r.resultMasterId !== resultMasterId)) {
      throw new BadRequestError("একসাথে শুধু একটি ফলাফলের সংশোধন প্রয়োগ করা যায়।");
    }

    const ids = rows.map((r) => r.id);
    // Only rows THIS call moved to APPROVED are ours to release (decidedBy).
    const release = () =>
      prisma.resultCorrection.updateMany({
        where: { id: { in: ids }, status: "APPROVED", decidedBy: userId },
        data: { status: "PENDING", decidedBy: null, decidedAt: null, decisionNote: null },
      });

    const claimed = await prisma.resultCorrection.updateMany({
      where: { id: { in: ids }, status: "PENDING" },
      data: { status: "APPROVED", decidedBy: userId, decidedAt: new Date(), decisionNote },
    });
    if (claimed.count !== ids.length) {
      // At least one row was already decided by someone else - back out of
      // the ones we did claim rather than apply a partial set.
      await release();
      throw new ConflictError(ALREADY_DECIDED_MESSAGE);
    }

    let appliedMarkField = false;
    try {
      // Every value is validated and turned into a write BEFORE anything
      // runs, and all writes (plus the APPLIED flip) then commit in ONE
      // transaction: a class-wide correction either lands completely or not
      // at all - never half-applied.
      const markWrites = new Map<string, { studentId: number; bookId: number; data: Record<string, unknown> }>();
      const summaryWrites: { studentId: number; data: Record<string, unknown> }[] = [];

      for (const row of rows) {
        if (MARK_FIELDS.has(row.field)) {
          if (!row.studentId || !row.bookId) {
            throw new BadRequestError("সংশোধন প্রয়োগ করা যায়নি — অসম্পূর্ণ তথ্য।");
          }
          // Several fields of one cell (mark + is_absent + note) merge into
          // a single UPDATE.
          const key = `${row.studentId}:${row.bookId}`;
          const entry = markWrites.get(key) ?? { studentId: row.studentId, bookId: row.bookId, data: {} };
          Object.assign(entry.data, this.markFieldData(row.field, row.newValue));
          markWrites.set(key, entry);
          appliedMarkField = true;
        } else {
          if (!row.studentId) {
            throw new BadRequestError("সংশোধন প্রয়োগ করা যায়নি — অসম্পূর্ণ তথ্য।");
          }
          summaryWrites.push({ studentId: row.studentId, data: this.summaryFieldData(row.field, row.newValue) });
        }
      }

      await prisma.$transaction([
        ...[...markWrites.values()].map((w) =>
          prisma.mark.updateMany({
            where: { resultMasterId, studentId: w.studentId, bookId: w.bookId },
            data: w.data,
          }),
        ),
        ...summaryWrites.map((w) =>
          prisma.resultSummary.updateMany({
            where: { resultMasterId, studentId: w.studentId },
            data: w.data,
          }),
        ),
        prisma.resultCorrection.updateMany({
          where: { id: { in: ids }, status: "APPROVED" },
          data: { status: "APPLIED", appliedAt: new Date() },
        }),
      ]);
    } catch (err) {
      await release();
      throw err;
    }

    await this.finalizeApplied(madrasaId, userId, resultMasterId, rows, appliedMarkField);
  }

  private async finalizeApplied(
    madrasaId: number,
    userId: number,
    resultMasterId: number,
    applied: { id: number; field: string; newValue: string | null }[],
    appliedMarkField: boolean,
  ) {
    if (appliedMarkField) {
      // Keep total/average/grade/rank consistent with the corrected marks.
      await resultPanelService.reprocessResultMaster(madrasaId, resultMasterId);
    }

    const view = await resultPanelService.getFullResultView(madrasaId, 0, 0, resultMasterId);
    await prisma.resultSnapshot.create({
      data: {
        madrasaId,
        resultMasterId,
        snapshotJson: JSON.stringify(view),
        reason: "CORRECTION",
        createdBy: userId,
      },
    });

    if (applied.length <= AUDIT_LOG_PER_ROW_LIMIT) {
      for (const row of applied) {
        await logActivity({
          madrasa_id: madrasaId,
          user_id: userId,
          action: "APPLY",
          entity: "results/corrections",
          entity_id: row.id,
          details: JSON.stringify({ field: row.field, new_value: row.newValue }),
        });
      }
    } else {
      await logActivity({
        madrasa_id: madrasaId,
        user_id: userId,
        action: "APPLY",
        entity: "results/corrections",
        entity_id: resultMasterId,
        details: JSON.stringify({ result_master_id: resultMasterId, count: applied.length }),
      });
    }
  }

  private readMarkField(mark: { mark: number; isAbsent: boolean; isExempted: boolean; isWithheld: boolean; note: string | null }, field: string): string {
    switch (field) {
      case "mark":
        return String(mark.mark);
      case "is_absent":
        return String(mark.isAbsent);
      case "is_exempted":
        return String(mark.isExempted);
      case "is_withheld":
        return String(mark.isWithheld);
      case "note":
        return mark.note ?? "";
      default:
        return "";
    }
  }

  private readSummaryField(
    summary: {
      generalGrade: string | null;
      madrasaGrade: string | null;
      total: number;
      average: number;
      status: string | null;
      rankNo: number | null;
    },
    field: string,
  ): string {
    switch (field) {
      case "general_grade":
        return summary.generalGrade ?? "";
      case "madrasa_grade":
        return summary.madrasaGrade ?? "";
      case "total":
        return String(summary.total);
      case "average":
        return String(summary.average);
      case "status":
        return summary.status ?? "";
      case "rank_no":
        return summary.rankNo === null || summary.rankNo === undefined ? "" : String(summary.rankNo);
      default:
        return "";
    }
  }

  /** The Mark columns one correction field writes. Pure - the caller runs
   * the UPDATE (merged with the cell's other fields, inside a transaction). */
  private markFieldData(field: string, newValue: string | null): Record<string, unknown> {
    // Field-driven, so the shape can't be statically expressed as one
    // Prisma input type - matches the allow-list validated in
    // prepareCorrection above.
    const data: Record<string, unknown> = {};
    switch (field) {
      case "mark": {
        const n = Number(newValue);
        if (!Number.isFinite(n)) throw new BadRequestError("নম্বরের মান সঠিক নয়।");
        data.mark = n;
        break;
      }
      case "is_absent":
        data.isAbsent = newValue === "true";
        break;
      case "is_exempted":
        data.isExempted = newValue === "true";
        break;
      case "is_withheld":
        data.isWithheld = newValue === "true";
        break;
      case "note":
        data.note = newValue || null;
        break;
    }
    return data;
  }

  /** The ResultSummary columns one correction field writes (pure). */
  private summaryFieldData(field: string, newValue: string | null): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    switch (field) {
      case "general_grade":
        data.generalGrade = newValue || null;
        break;
      case "madrasa_grade":
        data.madrasaGrade = newValue || null;
        break;
      case "total": {
        const n = Number(newValue);
        if (!Number.isFinite(n)) throw new BadRequestError("total-এর মান সঠিক নয়।");
        data.total = n;
        break;
      }
      case "average": {
        const n = Number(newValue);
        if (!Number.isFinite(n)) throw new BadRequestError("average-এর মান সঠিক নয়।");
        data.average = n;
        break;
      }
      case "status": {
        const allowed = new Set(["PASS", "FAIL", "ABSENT"]);
        if (newValue && !allowed.has(newValue)) throw new BadRequestError("status-এর মান সঠিক নয়।");
        data.status = newValue || null;
        break;
      }
      case "rank_no": {
        if (newValue === null || newValue === "") {
          data.rankNo = null;
        } else {
          const n = Number(newValue);
          if (!Number.isInteger(n)) throw new BadRequestError("rank_no-এর মান সঠিক নয়।");
          data.rankNo = n;
        }
        break;
      }
    }
    return data;
  }
}

export const resultCorrectionService = new ResultCorrectionService();
