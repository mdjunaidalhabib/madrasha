import { TransactionClient } from "../../shared/database/transaction";
import { BadRequestError } from "../../shared/errors";

/**
 * Student registration numbers are unique madrasa-wide, but each class can
 * own a block of them (MadrasaClass.regNoStart/regNoEnd - e.g. one class
 * 1-50, the next 51-100), so a class's list reads as one tidy run. Every
 * flow that hands out a number (admission approval, bulk admission,
 * promotion, class change) goes through here.
 */

/** Serialises registration-number allocation per madrasa. Uniqueness is
 * madrasa-wide (and the no-block fallback looks past every block), so the
 * lock can't be narrower than the madrasa. */
export const lockStudentRegistrationScopeOnTx = (tx: TransactionClient, madrasaId: number) => {
  const key = `student-registration:${madrasaId}`;
  // $executeRaw, not $queryRaw - pg_advisory_xact_lock() returns `void`,
  // which Prisma can't deserialize (see StudentRepository.lockKeyOnTx).
  return tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
};

export class RegistrationBlockFullError extends BadRequestError {
  constructor(start: number, end: number) {
    super(
      `এই শ্রেণির রেজিস্ট্রেশন নম্বরের ব্লক (${start}–${end}) পূর্ণ হয়ে গেছে। ` +
        "তালিমাত সেটিংস → রেজি. নম্বর থেকে ব্লকটি বাড়িয়ে আবার চেষ্টা করুন।",
    );
  }
}

/**
 * Next registration number for a student of `classId`. The caller must
 * already hold lockStudentRegistrationScopeOnTx for this madrasa.
 *
 * - Class has a block: one past the highest number already used or ever
 *   issued inside the block (so a number freed by a promoted student is not
 *   reused). Throws RegistrationBlockFullError once the block is used up.
 * - No block: one past the highest number used anywhere in the madrasa or
 *   reserved by any class's block, so it never lands inside a block.
 */
export async function allocateStudentRegistrationNoOnTx(
  tx: TransactionClient,
  madrasaId: number,
  classId: number,
): Promise<number> {
  const block = await tx.madrasaClass.findFirst({
    where: { madrasaId, classId },
    select: { id: true, regNoStart: true, regNoEnd: true, regNoLastIssued: true },
  });

  if (block && block.regNoStart != null && block.regNoEnd != null) {
    const { regNoStart: start, regNoEnd: end } = block;
    // Trashed students included - they still hold their number.
    const used = await tx.student.aggregate({
      where: { madrasaId, registrationNo: { gte: start, lte: end } },
      _max: { registrationNo: true },
    });
    const lastIssued =
      block.regNoLastIssued != null && block.regNoLastIssued >= start && block.regNoLastIssued <= end
        ? block.regNoLastIssued
        : start - 1;
    const next = Math.max(start - 1, lastIssued, used._max.registrationNo ?? 0) + 1;
    if (next > end) throw new RegistrationBlockFullError(start, end);

    await tx.madrasaClass.update({ where: { id: block.id }, data: { regNoLastIssued: next } });
    return next;
  }

  const [used, blocks] = await Promise.all([
    tx.student.aggregate({ where: { madrasaId }, _max: { registrationNo: true } }),
    tx.madrasaClass.aggregate({ where: { madrasaId, regNoEnd: { not: null } }, _max: { regNoEnd: true } }),
  ]);
  return Math.max(used._max.registrationNo ?? 0, blocks._max.regNoEnd ?? 0) + 1;
}
