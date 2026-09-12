import { CorrectionStatus } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { BadRequestError, ConflictError, NotFoundError } from "../../shared/errors";
import { logActivity } from "../../shared/utils/activity.util";
import { isPrivilegedActor } from "../../shared/utils/rbac.util";
import { resultPanelRepository } from "./result-panel.repository";
import { resultPanelService } from "./result-panel.service";

export interface RequestCorrectionDto {
  student_id?: number | string;
  book_id?: number | string;
  field: string;
  new_value: string | number | boolean | null;
  reason: string;
}

// Mark-level fields target one (resultMasterId, studentId, bookId) Mark row.
const MARK_FIELDS = new Set(["mark", "is_absent", "is_exempted", "is_withheld", "note"]);
// Summary-level fields target one (resultMasterId, studentId) ResultSummary row.
const SUMMARY_FIELDS = new Set([
  "general_grade",
  "madrasa_grade",
  "total",
  "average",
  "status",
  "rank_no",
]);

/**
 * Controlled correction workflow for results that have already passed
 * publish (or lock) - see prisma/models/result.prisma's ResultCorrection
 * model doc comment. A correction is only ever *applied* after an explicit
 * approve decision; requesting one never touches the live Mark/ResultSummary
 * row.
 */
export class ResultCorrectionService {
  private async assertMaster(madrasaId: number, resultMasterId: number) {
    const master = await resultPanelRepository.findResultMasterById(resultMasterId, madrasaId);
    if (!master) throw new NotFoundError("Result session not found");
    return master;
  }

  async requestCorrection(
    madrasaId: number,
    userId: number,
    resultMasterId: number,
    body: RequestCorrectionDto,
  ) {
    const master = await this.assertMaster(madrasaId, resultMasterId);

    if (master.status !== "PUBLISHED" && master.status !== "LOCKED") {
      throw new ConflictError(
        "ফলাফল প্রকাশিত/লক অবস্থায় থাকলেই কেবল সংশোধনের অনুরোধ করা যায় — এখনো প্রকাশ না হলে সরাসরি নম্বর সম্পাদনা করুন।",
      );
    }

    const field = String(body.field || "");
    const reason = String(body.reason || "").trim();
    if (!reason) throw new BadRequestError("সংশোধনের কারণ উল্লেখ করা আবশ্যক।");

    const studentId = body.student_id ? Number(body.student_id) : null;
    const bookId = body.book_id ? Number(body.book_id) : null;

    let oldValue: string | null;

    if (MARK_FIELDS.has(field)) {
      if (!studentId || !bookId) {
        throw new BadRequestError("mark-স্তরের সংশোধনের জন্য student_id ও book_id আবশ্যক।");
      }
      const mark = await prisma.mark.findFirst({ where: { resultMasterId, studentId, bookId } });
      if (!mark) throw new NotFoundError("এই শিক্ষার্থী/বিষয়ের নম্বরের কোনো রেকর্ড পাওয়া যায়নি।");
      oldValue = this.readMarkField(mark, field);
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

    const newValue =
      body.new_value === null || body.new_value === undefined ? null : String(body.new_value);

    let created;
    try {
      created = await prisma.resultCorrection.create({
        data: {
          madrasaId,
          resultMasterId,
          studentId,
          bookId,
          field,
          oldValue,
          newValue,
          reason,
          status: "PENDING",
          requestedBy: userId,
        },
      });
    } catch (err: any) {
      // uniq_pending_result_correction (partial unique index, see the
      // result.prisma ResultCorrection doc-comment) blocks a second PENDING
      // request for the same (resultMasterId, studentId, bookId, field).
      if (err?.code === "P2002") {
        throw new ConflictError(
          "এই একই বিষয়ের জন্য ইতিমধ্যে একটি সংশোধনের অনুরোধ অপেক্ষমাণ (PENDING) আছে — আগেরটি সিদ্ধান্ত না হওয়া পর্যন্ত নতুন অনুরোধ দেওয়া যাবে না।",
        );
      }
      throw err;
    }

    await logActivity({
      madrasa_id: madrasaId,
      user_id: userId,
      action: "CREATE",
      entity: "results/corrections",
      entity_id: created.id,
      details: JSON.stringify({
        result_master_id: resultMasterId,
        field,
        student_id: studentId,
        book_id: bookId,
        old_value: oldValue,
        new_value: newValue,
        reason,
      }),
    });

    return { message: "সংশোধনের অনুরোধ জমা দেওয়া হয়েছে", correction_id: created.id };
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
      throw new ConflictError("এই সংশোধনের অনুরোধ ইতিমধ্যে সিদ্ধান্ত নেওয়া হয়ে গেছে।");
    }

    if (correction.requestedBy === userId && !(await isPrivilegedActor(userId))) {
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
      if (rejected.count === 0) {
        throw new ConflictError("এই সংশোধনের অনুরোধ ইতিমধ্যে সিদ্ধান্ত নেওয়া হয়ে গেছে।");
      }

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

    // Atomically claim the PENDING row (guarded the same way as the reject
    // path above) BEFORE applying any field change, so two concurrent
    // approve() calls on the same request can't both mutate live data - the
    // loser's updateMany matches zero rows and bails out here instead of
    // double-applying the correction. Uses APPROVED as a transient
    // "claimed, applying now" marker; the field mutation below then
    // advances it to APPLIED.
    const claimed = await prisma.resultCorrection.updateMany({
      where: { id: correctionId, status: "PENDING" },
      data: {
        status: "APPROVED",
        decidedBy: userId,
        decidedAt: new Date(),
        decisionNote: decisionNote?.trim() || null,
      },
    });
    if (claimed.count === 0) {
      throw new ConflictError("এই সংশোধনের অনুরোধ ইতিমধ্যে সিদ্ধান্ত নেওয়া হয়ে গেছে।");
    }

    const isMarkField = MARK_FIELDS.has(correction.field);

    if (isMarkField) {
      if (!correction.studentId || !correction.bookId) {
        throw new BadRequestError("সংশোধন প্রয়োগ করা যায়নি — অসম্পূর্ণ তথ্য।");
      }
      await this.applyMarkField(
        correction.resultMasterId,
        correction.studentId,
        correction.bookId,
        correction.field,
        correction.newValue,
      );
    } else {
      if (!correction.studentId) {
        throw new BadRequestError("সংশোধন প্রয়োগ করা যায়নি — অসম্পূর্ণ তথ্য।");
      }
      await this.applySummaryField(
        correction.resultMasterId,
        correction.studentId,
        correction.field,
        correction.newValue,
      );
    }

    await prisma.resultCorrection.update({
      where: { id: correctionId },
      data: { status: "APPLIED", appliedAt: new Date() },
    });

    if (isMarkField) {
      // Keep total/average/grade/rank consistent with the corrected mark by
      // re-running the SAME grading engine processResult uses - there must
      // be exactly one grading implementation, never a second copy.
      await resultPanelService.reprocessResultMaster(madrasaId, correction.resultMasterId);
    }

    // Snapshot the result after every applied correction (mark-level or
    // summary-level) - audit/integrity record only, same as publish; not
    // wired into any read path yet.
    const view = await resultPanelService.getFullResultView(madrasaId, 0, 0, correction.resultMasterId);
    await prisma.resultSnapshot.create({
      data: {
        madrasaId,
        resultMasterId: correction.resultMasterId,
        snapshotJson: JSON.stringify(view),
        reason: "CORRECTION",
        createdBy: userId,
      },
    });

    await logActivity({
      madrasa_id: madrasaId,
      user_id: userId,
      action: "APPLY",
      entity: "results/corrections",
      entity_id: correctionId,
      details: JSON.stringify({ field: correction.field, new_value: correction.newValue }),
    });

    return { message: "সংশোধন প্রয়োগ করা হয়েছে" };
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

  private async applyMarkField(
    resultMasterId: number,
    studentId: number,
    bookId: number,
    field: string,
    newValue: string | null,
  ) {
    // Field-driven, so the shape can't be statically expressed as one
    // Prisma input type - matches the allow-list validated in
    // requestCorrection above.
    const data: any = {};
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
    await prisma.mark.updateMany({ where: { resultMasterId, studentId, bookId }, data });
  }

  private async applySummaryField(
    resultMasterId: number,
    studentId: number,
    field: string,
    newValue: string | null,
  ) {
    const data: any = {};
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
    await prisma.resultSummary.updateMany({ where: { resultMasterId, studentId }, data });
  }
}

export const resultCorrectionService = new ResultCorrectionService();
