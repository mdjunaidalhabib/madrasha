import { ApiError, BadRequestError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import { promotionRepository, PromotionRepository } from "./promotion.repository";
import { PromotionExecuteRequestDto, PromotionPreviewRequestDto } from "./promotion.dto";
import { PROMOTION_STATUSES } from "./promotion.constants";
import { t } from "../../shared/i18n";
import { TransactionClient } from "../../shared/database/transaction";
import { createRegistrationNoBatchOnTx } from "../students/registration-no.allocator";
import { studentRepository } from "../students/student.repository";
import { tenantClassName, tenantClassNameSelect } from "../../shared/utils/tenant-name.util";
import { getReservedPersonnelNumbers } from "../../shared/utils/personnel-number.util";

const friendlyFailure = (logTag: string, err: unknown, friendlyMessage: string): never => {
  logger.error(logTag, err);
  throw new ApiError(friendlyMessage, 500);
};

export class PromotionService {
  constructor(private readonly repository: PromotionRepository = promotionRepository) {}

  /**
   * Lists every active student in a class/year alongside a suggested
   * PROMOTED/RETAINED decision based on their result for the given exam
   * (if provided). Students with no matching result are suggested as
   * PROMOTED by default — the admin reviews and can flip any of them
   * before calling execute().
   */
  async preview(madrasaId: number, dto: PromotionPreviewRequestDto) {
    if (!dto.from_class_id || !dto.from_year) {
      throw new BadRequestError(
        t({
          bn: "from_class_id ও from_year আবশ্যক",
          en: "from_class_id and from_year are required",
        }),
      );
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
          registration_no: student.registrationNo,
          class_id: student.classId,
          result_status: resultStatus || "NO_RESULT",
          // A student absent from every subject (status ABSENT) is treated
          // the same as FAIL here — they never actually completed the exam,
          // so they shouldn't be silently suggested for promotion either.
          suggested_status:
            resultStatus === "FAIL" || resultStatus === "ABSENT" ? "RETAINED" : "PROMOTED",
        };
      });
    } catch (err) {
      return friendlyFailure(
        "promotionPreview error:",
        err,
        t({ bn: "প্রমোশনের প্রিভিউ তৈরি করা যায়নি", en: "Failed to build promotion preview" }),
      );
    }
  }

  /**
   * Read-only allocation shared by destination preview and execution.
   * Registration counters are only flushed by execute, under the same
   * locks used for admission and student updates.
   */
  private async prepare(tx: TransactionClient, madrasaId: number, dto: PromotionExecuteRequestDto) {
    const fromClassId = Number(dto.from_class_id);
    const toClassId = Number(dto.to_class_id);
    if (
      !Number.isInteger(fromClassId) ||
      !Number.isInteger(toClassId) ||
      !fromClassId ||
      !toClassId ||
      !dto.from_year ||
      !dto.to_year ||
      !Array.isArray(dto.decisions) ||
      !dto.decisions.length
    ) {
      throw new BadRequestError(
        t({
          bn: "জামাত, সেশন ও শিক্ষার্থী নির্বাচন করুন",
          en: "Select classes, sessions and students",
        }),
      );
    }
    if (fromClassId === toClassId && dto.from_year === dto.to_year) {
      throw new BadRequestError(
        t({
          bn: "নতুন জামাত অথবা নতুন সেশন নির্বাচন করুন",
          en: "Select a different class or session",
        }),
      );
    }
    const ids = dto.decisions.map((d) => Number(d.student_id));
    if (
      new Set(ids).size !== ids.length ||
      ids.some((id) => !Number.isInteger(id) || id <= 0) ||
      dto.decisions.some((d) => !PROMOTION_STATUSES.includes(d.status))
    ) {
      throw new BadRequestError(
        t({ bn: "শিক্ষার্থী বা সিদ্ধান্তের তালিকা সঠিক নয়", en: "Invalid students or decisions" }),
      );
    }
    const classes = await tx.class.findMany({
      where: { id: { in: [fromClassId, toClassId] }, madrasaClasses: { some: { madrasaId } } },
      select: { id: true, divisionId: true, ...tenantClassNameSelect(madrasaId) },
    });
    if (![fromClassId, toClassId].every((id) => classes.some((c) => c.id === id))) {
      throw new BadRequestError(
        t({ bn: "নির্বাচিত জামাত পাওয়া যায়নি", en: "Selected class not found" }),
      );
    }
    const students = await tx.student.findMany({
      where: {
        id: { in: ids },
        madrasaId,
        classId: fromClassId,
        academicYear: String(dto.from_year),
        isActive: 1,
        deletedAt: null,
        admissionStatus: "APPROVED",
        roll: { not: null },
      },
    });
    if (students.length !== ids.length) {
      throw new BadRequestError(
        t({
          bn: "শিক্ষার্থীর তথ্য পরিবর্তিত হয়েছে। আবার প্রিভিউ দেখুন",
          en: "Student details changed. Reload the preview",
        }),
      );
    }
    const registrations = createRegistrationNoBatchOnTx(tx, madrasaId);
    const studentsById = new Map(students.map((student) => [student.id, student]));
    const order = new Map(ids.map((id, index) => [id, index]));
    const sessionIds = new Map<number, number>();
    const occupied = new Map<number, Map<number, number>>();
    const retainedRolls = dto.decisions
      .filter((decision) => decision.status === "RETAINED")
      .map((decision) => studentsById.get(Number(decision.student_id))!.roll!);
    const plans = [];
    // Retained students reserve their existing rolls before promoted students receive new rolls.
    const decisions = [...dto.decisions].sort(
      (a, b) => Number(a.status !== "RETAINED") - Number(b.status !== "RETAINED"),
    );
    for (const decision of decisions) {
      const student = studentsById.get(Number(decision.student_id))!;
      const targetClassId = decision.status === "PROMOTED" ? toClassId : fromClassId;
      const targetClass = classes.find((c) => c.id === targetClassId)!;
      const year = decision.status === "TRANSFERRED" ? student.academicYear : String(dto.to_year);
      let roll = student.roll!;
      let registrationNo = student.registrationNo;
      let sessionId = student.sessionId;
      if (decision.status !== "TRANSFERRED") {
        if (!sessionIds.has(targetClassId)) {
          const session =
            (await tx.session.findFirst({
              where: { madrasaId, name: year, divisionId: targetClass.divisionId },
            })) ??
            (await tx.session.findFirst({ where: { madrasaId, name: year, divisionId: null } }));
          if (!session)
            throw new BadRequestError(
              t({
                bn: "এই জামাতের বিভাগে নির্বাচিত সেশন তৈরি করুন",
                en: "Create the selected session in this class's division first",
              }),
            );
          sessionIds.set(targetClassId, session.id);
        }
        sessionId = sessionIds.get(targetClassId)!;
        if (!occupied.has(targetClassId)) {
          const roster = await tx.student.findMany({
            where: { madrasaId, classId: targetClassId, academicYear: year, roll: { not: null } },
            select: { id: true, roll: true },
          });
          occupied.set(targetClassId, new Map(roster.map((s) => [s.roll!, s.id])));
          const history = await getReservedPersonnelNumbers(tx, madrasaId, "student-roll", `${targetClassId}:${year}`);
          const used = occupied.get(targetClassId)!;
          for (const number of history) if (!used.has(number)) used.set(number, 0);
        }
        const used = occupied.get(targetClassId)!;
        if (decision.status === "PROMOTED" || (used.has(roll) && used.get(roll) !== student.id)) {
          roll =
            Math.max(0, ...used.keys(), ...(decision.status === "RETAINED" ? retainedRolls : [])) +
            1;
        }
        used.set(roll, student.id);
        if (
          decision.status === "PROMOTED" &&
          student.classId !== targetClassId &&
          registrationNo != null
        ) {
          registrationNo = await registrations.next(targetClassId);
        }
      }
      plans.push({
        student_id: student.id,
        name_bn: student.nameBn,
        status: decision.status,
        old_roll: student.roll,
        old_registration_no: student.registrationNo,
        from_class_id: student.classId,
        from_class_name: tenantClassName(classes.find((c) => c.id === fromClassId)),
        class_id: targetClassId,
        class_name: tenantClassName(targetClass),
        academic_year: year,
        roll,
        registration_no: registrationNo,
        session_id: sessionId,
        division_id: targetClass.divisionId,
      });
    }
    plans.sort((a, b) => order.get(a.student_id)! - order.get(b.student_id)!);
    return { plans, registrations };
  }

  async targetPreview(madrasaId: number, dto: PromotionExecuteRequestDto) {
    return this.repository.runTransaction(async (tx) => {
      const { plans } = await this.prepare(tx, madrasaId, dto);
      return { rows: plans, preview_token: JSON.stringify(plans) };
    });
  }

  async execute(
    madrasaId: number,
    promotedById: number | undefined,
    dto: PromotionExecuteRequestDto,
  ) {
    if (!Array.isArray(dto.decisions) || !dto.decisions.length) {
      throw new BadRequestError(t({ bn: "শিক্ষার্থী নির্বাচন করুন", en: "Select students" }));
    }
    return this.repository.runTransaction(async (tx) => {
      const ids = [...new Set((dto.decisions || []).map((d) => Number(d.student_id)))].sort(
        (a, b) => a - b,
      );
      for (const id of ids) {
        if (!Number.isInteger(id) || id <= 0) throw new BadRequestError("Invalid student ID");
        await studentRepository.lockStudentRecordOnTx(tx, madrasaId, id);
      }
      for (const classId of [...new Set([Number(dto.from_class_id), Number(dto.to_class_id)])].sort(
        (a, b) => a - b,
      )) {
        await studentRepository.lockRollScopeOnTx(tx, madrasaId, classId, String(dto.to_year));
      }
      await this.repository.lockRegistrationScopeOnTx(tx, madrasaId);
      const { plans, registrations } = await this.prepare(tx, madrasaId, dto);
      if (dto.preview_token && dto.preview_token !== JSON.stringify(plans)) {
        throw new BadRequestError(
          t({
            bn: "রোল বা শিক্ষার্থীর তথ্য পরিবর্তিত হয়েছে। গন্তব্য প্রিভিউ আবার দেখুন",
            en: "Rolls or student details changed. Refresh the destination preview",
          }),
        );
      }
      const batch = await this.repository.createBatchOnTx(tx, {
        madrasaId,
        fromClassId: Number(dto.from_class_id),
        toClassId: Number(dto.to_class_id),
        fromYear: String(dto.from_year),
        toYear: String(dto.to_year),
        promotedById: promotedById ?? 0,
      });
      const summary = { promoted: 0, retained: 0, transferred: 0 };
      for (const plan of plans) {
        if (plan.status !== "TRANSFERRED") {
          await tx.student.update({
            where: { id: plan.student_id },
            data: {
              classId: plan.class_id,
              academicYear: plan.academic_year,
              ...(plan.division_id != null ? { divisionId: plan.division_id } : {}),
              sessionId: plan.session_id,
              roll: plan.roll,
              registrationNo: plan.registration_no,
              ...(plan.status === "PROMOTED" ? { previousClassId: Number(dto.from_class_id) } : {}),
            },
          });
        }
        await this.repository.createRecordOnTx(tx, {
          batchId: batch.id,
          studentId: plan.student_id,
          oldRoll: plan.old_roll!,
          newRoll: plan.status === "TRANSFERRED" ? null : plan.roll,
          status: plan.status,
        });
        summary[
          plan.status === "PROMOTED"
            ? "promoted"
            : plan.status === "RETAINED"
              ? "retained"
              : "transferred"
        ]++;
      }
      await registrations.flush();
      return { batchId: batch.id, ...summary };
    });
  }
}

export const promotionService = new PromotionService();
