import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { ApiError, BadRequestError, ConflictError, NotFoundError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import { timeRangesOverlap } from "../../shared/utils/time-range.util";
import { examInvigilatorRepository, ExamInvigilatorRepository } from "./exam-invigilator.repository";
import { AssignInvigilatorRequestDto } from "./exam-invigilator.dto";
import { INVIGILATOR_TYPES, INVIGILATOR_ROLES, INVIGILATOR_ASSIGNMENT_STATUSES } from "./exam-invigilator.constants";
import { t } from "../../shared/i18n";

const isEmpty = (value: unknown) => value === undefined || value === null || String(value).trim() === "";

const isDuplicateError = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

// Postgres SQLSTATE 40001 ("could not serialize access due to concurrent
// update") - the expected, retryable failure mode of a SERIALIZABLE
// transaction losing a real conflict, not a bug.
const isSerializationFailure = (err: unknown) =>
  err instanceof Prisma.PrismaClientUnknownRequestError && /40001/.test(err.message);

const friendlyFailure = (logTag: string, err: unknown, friendlyMessage: string): never => {
  logger.error(logTag, err);
  throw new ApiError(friendlyMessage, 500);
};

type TargetRoutine = { id: number; examDate: Date; startTime: string; endTime: string };

export class ExamInvigilatorService {
  constructor(private readonly repository: ExamInvigilatorRepository = examInvigilatorRepository) {}

  async listByRoutine(madrasaId: number, examRoutineId: number) {
    try {
      return await this.repository.findByRoutine(madrasaId, examRoutineId);
    } catch (err) {
      return friendlyFailure("listByRoutine error:", err, t({ bn: "পরিদর্শক নিয়োগের তালিকা লোড করা যায়নি", en: "Failed to load invigilator assignments" }));
    }
  }

  async assign(madrasaId: number, dto: AssignInvigilatorRequestDto) {
    if (isEmpty(dto.exam_routine_id) || isEmpty(dto.invigilator_type) || isEmpty(dto.invigilator_id)) {
      throw new BadRequestError(t({ bn: "exam_routine_id, invigilator_type ও invigilator_id আবশ্যক", en: "exam_routine_id, invigilator_type and invigilator_id are required" }));
    }
    const invigilatorType = String(dto.invigilator_type).toUpperCase();
    if (!INVIGILATOR_TYPES.includes(invigilatorType as (typeof INVIGILATOR_TYPES)[number])) {
      throw new BadRequestError(t({ bn: `invigilator_type অবশ্যই এগুলোর একটি হতে হবে: ${INVIGILATOR_TYPES.join(", ")}`, en: `invigilator_type must be one of ${INVIGILATOR_TYPES.join(", ")}` }));
    }
    const role = dto.role ? String(dto.role).toUpperCase() : "ASSISTANT";
    if (!INVIGILATOR_ROLES.includes(role as (typeof INVIGILATOR_ROLES)[number])) {
      throw new BadRequestError(t({ bn: `role অবশ্যই এগুলোর একটি হতে হবে: ${INVIGILATOR_ROLES.join(", ")}`, en: `role must be one of ${INVIGILATOR_ROLES.join(", ")}` }));
    }

    const examRoutineId = Number(dto.exam_routine_id);
    const invigilatorId = Number(dto.invigilator_id);

    const routine = await this.repository.findRoutineDateTime(examRoutineId, madrasaId);
    if (!routine) throw new NotFoundError(t({ bn: "পরীক্ষার রুটিন পাওয়া যায়নি", en: "Exam routine not found" }));

    const invigilatorExists = await this.repository.invigilatorExists(madrasaId, invigilatorType, invigilatorId);
    if (!invigilatorExists) throw new NotFoundError(t({ bn: `${invigilatorType.toLowerCase()} পাওয়া যায়নি`, en: `${invigilatorType.toLowerCase()} not found` }));

    // The overlap check (a read) and the create (a write) run inside one
    // SERIALIZABLE transaction, re-checking overlap against the
    // transaction's own snapshot right before the insert - Postgres will
    // abort one side with a serialization failure (40001) rather than let
    // two concurrent requests both pass the check and double-book the same
    // person into overlapping slots. The exact-duplicate-slot case is still
    // caught separately via the DB unique constraint (P2002) below.
    try {
      await prisma.$transaction(
        async (tx) => {
          await this.assertNoInvigilatorConflict(madrasaId, invigilatorType, invigilatorId, routine, tx);
          await this.repository.create(
            madrasaId,
            {
              examRoutineId,
              invigilatorType,
              invigilatorId,
              role,
              notes: dto.notes?.trim() || null,
            },
            tx,
          );
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err) {
      if (isDuplicateError(err)) throw new ConflictError(t({ bn: "এই ব্যক্তি ইতিমধ্যে এই পরীক্ষার স্লটে নিয়োগপ্রাপ্ত", en: "This person is already assigned to this exam slot" }));
      if (err instanceof ConflictError) throw err;
      if (isSerializationFailure(err)) {
        throw new ConflictError(
          t({ bn: "একই সময়ে অন্য একটি অনুরোধের সাথে সংঘর্ষ হয়েছে — আবার চেষ্টা করুন।", en: "This conflicted with another request made at the same time — please try again." }),
        );
      }
      return friendlyFailure("assign error:", err, t({ bn: "পরিদর্শক নিয়োগ করা যায়নি", en: "Failed to assign invigilator" }));
    }
  }

  async updateStatus(id: number, madrasaId: number, status: unknown) {
    const value = String(status).toUpperCase();
    if (!INVIGILATOR_ASSIGNMENT_STATUSES.includes(value as (typeof INVIGILATOR_ASSIGNMENT_STATUSES)[number])) {
      throw new BadRequestError(t({ bn: `status অবশ্যই এগুলোর একটি হতে হবে: ${INVIGILATOR_ASSIGNMENT_STATUSES.join(", ")}`, en: `status must be one of ${INVIGILATOR_ASSIGNMENT_STATUSES.join(", ")}` }));
    }
    try {
      const result = await this.repository.updateStatus(id, madrasaId, { status: value });
      if (!result.count) throw new NotFoundError(t({ bn: "পরিদর্শক নিয়োগ পাওয়া যায়নি", en: "Invigilator assignment not found" }));
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      return friendlyFailure("updateStatus error:", err, t({ bn: "পরিদর্শক নিয়োগ আপডেট করা যায়নি", en: "Failed to update invigilator assignment" }));
    }
  }

  async remove(id: number, madrasaId: number) {
    try {
      const result = await this.repository.remove(id, madrasaId);
      if (!result.count) throw new NotFoundError(t({ bn: "পরিদর্শক নিয়োগ পাওয়া যায়নি", en: "Invigilator assignment not found" }));
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      return friendlyFailure("remove error:", err, t({ bn: "পরিদর্শক নিয়োগ বাতিল করা যায়নি", en: "Failed to remove invigilator assignment" }));
    }
  }

  private async assertNoInvigilatorConflict(
    madrasaId: number,
    invigilatorType: string,
    invigilatorId: number,
    targetRoutine: TargetRoutine,
    tx?: Prisma.TransactionClient,
  ) {
    const others = await this.repository.findOtherAssignmentsForPersonOnDate(
      madrasaId,
      invigilatorType,
      invigilatorId,
      targetRoutine.examDate,
      targetRoutine.id,
      tx,
    );
    const clash = others.find((o) =>
      timeRangesOverlap(
        targetRoutine.startTime,
        targetRoutine.endTime,
        o.examRoutine.startTime,
        o.examRoutine.endTime,
      ),
    );
    if (clash) {
      throw new ConflictError(
        t({ bn: `এই ব্যক্তি একই সময়ে অন্য একটি পরীক্ষার রুটিনে (#${clash.examRoutine.id}) পরিদর্শক হিসেবে নিয়োগপ্রাপ্ত`, en: `This person is already assigned as an invigilator to another exam routine (#${clash.examRoutine.id}) at an overlapping time` }),
      );
    }
  }
}

export const examInvigilatorService = new ExamInvigilatorService();
