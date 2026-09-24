import { ApiError, BadRequestError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import { promotionRepository, PromotionRepository } from "./promotion.repository";
import { sessionRepository, SessionRepository } from "../session/session.repository";
import {
  PromotionExecuteRequestDto,
  PromotionPreviewRequestDto,
} from "./promotion.dto";
import { PROMOTION_STATUSES } from "./promotion.constants";

const friendlyFailure = (logTag: string, err: unknown, friendlyMessage: string): never => {
  logger.error(logTag, err);
  throw new ApiError(friendlyMessage, 500);
};

export class PromotionService {
  constructor(
    private readonly repository: PromotionRepository = promotionRepository,
    private readonly sessions: SessionRepository = sessionRepository,
  ) {}

  /**
   * Lists every active student in a class/year alongside a suggested
   * PROMOTED/RETAINED decision based on their result for the given exam
   * (if provided). Students with no matching result are suggested as
   * PROMOTED by default — the admin reviews and can flip any of them
   * before calling execute().
   */
  async preview(madrasaId: number, dto: PromotionPreviewRequestDto) {
    if (!dto.from_class_id || !dto.from_year) {
      throw new BadRequestError("from_class_id and from_year are required");
    }

    const classId = Number(dto.from_class_id);
    const examId = dto.exam_id ? Number(dto.exam_id) : undefined;

    try {
      const [students, resultMaster] = await Promise.all([
        this.repository.findStudentsInClass(madrasaId, classId, String(dto.from_year)),
        this.repository.findResultMaster(madrasaId, classId, examId),
      ]);

      const statusByStudentId = new Map<number, string>();
      for (const row of resultMaster?.summary || []) {
        if (row.status) statusByStudentId.set(row.studentId, row.status);
      }

      return students.map((student) => {
        const resultStatus = statusByStudentId.get(student.id);
        return {
          student_id: student.id,
          name_bn: student.nameBn,
          roll: student.roll,
          result_status: resultStatus || "NO_RESULT",
          // A student absent from every subject (status ABSENT) is treated
          // the same as FAIL here — they never actually completed the exam,
          // so they shouldn't be silently suggested for promotion either.
          suggested_status:
            resultStatus === "FAIL" || resultStatus === "ABSENT" ? "RETAINED" : "PROMOTED",
        };
      });
    } catch (err) {
      return friendlyFailure("promotionPreview error:", err, "Failed to build promotion preview");
    }
  }

  /**
   * Bulk-promotes/retains/transfers a class in one transaction. New rolls
   * for promoted students are assigned sequentially starting after the
   * current highest roll already used in the destination class/year, so
   * this is safe to re-run for a second batch of the same target class.
   */
  async execute(madrasaId: number, promotedById: number | undefined, dto: PromotionExecuteRequestDto) {
    if (!dto.from_class_id || !dto.to_class_id || !dto.from_year || !dto.to_year) {
      throw new BadRequestError("from_class_id, to_class_id, from_year and to_year are required");
    }
    if (!Array.isArray(dto.decisions) || dto.decisions.length === 0) {
      throw new BadRequestError("decisions must be a non-empty array");
    }
    for (const decision of dto.decisions) {
      if (!PROMOTION_STATUSES.includes(decision.status)) {
        throw new BadRequestError(`Invalid status "${decision.status}" for student ${decision.student_id}`);
      }
    }

    const fromClassId = Number(dto.from_class_id);
    const toClassId = Number(dto.to_class_id);
    const fromYear = String(dto.from_year);
    const toYear = String(dto.to_year);

    // Resolve the destination Session once for the whole batch (same
    // toClassId/toYear for every student). Sessions are now scoped per
    // বিভাগ, so we resolve via the destination class's division. If no
    // Session row matches (e.g. the operator typed a to_year nobody has
    // set up as a real Session yet for that division), toSession stays
    // undefined and we fall back to the legacy academicYear-only behavior
    // rather than blocking the promotion.
    const toClassDivision = await this.repository.getClassDivisionId(madrasaId, toClassId);
    const toSession = await this.sessions.findByNameForTenant(madrasaId, toYear, toClassDivision?.divisionId ?? undefined);
    const toSessionId = toSession?.id;

    try {
      return await this.repository.runTransaction(async (tx) => {
        const batch = await this.repository.createBatchOnTx(tx, {
          madrasaId,
          fromClassId,
          toClassId,
          fromYear,
          toYear,
          promotedById: promotedById ?? 0,
        });

        let nextRoll = (await this.repository.getMaxRollOnTx(tx, madrasaId, toClassId, toYear)) + 1;
        // Each class has its own registration-number block - a promoted
        // student gets the next number of the destination class's block.
        await this.repository.lockRegistrationScopeOnTx(tx, madrasaId);
        const summary = { promoted: 0, retained: 0, transferred: 0 };

        for (const decision of dto.decisions) {
          const studentId = Number(decision.student_id);
          const student = await tx.student.findFirst({
            where: { id: studentId, madrasaId, deletedAt: null },
          });
          if (!student) continue; // silently skip students no longer valid for this tenant
          if (student.roll == null) continue; // still-PENDING/REJECTED applicant (see approveAdmission) - not a real enrolled student to promote/retain/transfer

          if (decision.status === "PROMOTED") {
            const assignedRoll = nextRoll++;
            await this.repository.promoteStudentOnTx(tx, studentId, {
              classId: toClassId,
              previousClassId: fromClassId,
              academicYear: toYear,
              roll: assignedRoll,
              ...(student.classId !== toClassId && student.registrationNo
                ? { registrationNo: await this.repository.allocateRegistrationNoOnTx(tx, madrasaId, toClassId) }
                : {}),
              ...(toSessionId !== undefined ? { sessionId: toSessionId } : {}),
            });
            await this.repository.createRecordOnTx(tx, {
              batchId: batch.id,
              studentId,
              oldRoll: student.roll,
              newRoll: assignedRoll,
              status: "PROMOTED",
            });
            summary.promoted += 1;
          } else if (decision.status === "RETAINED") {
            await this.repository.retainStudentOnTx(tx, studentId, toYear, toSessionId);
            await this.repository.createRecordOnTx(tx, {
              batchId: batch.id,
              studentId,
              oldRoll: student.roll,
              newRoll: student.roll,
              status: "RETAINED",
            });
            summary.retained += 1;
          } else {
            // TRANSFERRED: recorded for history; deactivating/removing the
            // student from active rolls is left to the existing student
            // delete/deactivate flow so this stays a pure audit record here.
            await this.repository.createRecordOnTx(tx, {
              batchId: batch.id,
              studentId,
              oldRoll: student.roll,
              newRoll: null,
              status: "TRANSFERRED",
            });
            summary.transferred += 1;
          }
        }

        return { batchId: batch.id, ...summary };
      });
    } catch (err) {
      // e.g. RegistrationBlockFullError - the admin needs its actual message.
      if (err instanceof BadRequestError) throw err;
      return friendlyFailure("promotionExecute error:", err, "Failed to execute promotion");
    }
  }
}

export const promotionService = new PromotionService();
