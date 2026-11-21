import { TransactionClient } from "../../shared/database/transaction";
import { BadRequestError } from "../../shared/errors";
import { createAvailableNumberPool } from "../../shared/utils/available-number.util";

/** All allocators share this tenant lock, including promotion and class changes. */
export const lockStudentRegistrationScopeOnTx = (tx: TransactionClient, madrasaId: number) => {
  const key = "student-registration:" + madrasaId;
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

/** Caller holds lockStudentRegistrationScopeOnTx. Trash retains its numbers. */
export async function allocateStudentRegistrationNoOnTx(
  tx: TransactionClient,
  madrasaId: number,
  classId: number,
): Promise<number> {
  const batch = createRegistrationNoBatchOnTx(tx, madrasaId);
  const next = await batch.next(classId);
  await batch.flush();
  return next;
}

/** One numeric roster read per batch; all class pools share the same occupied set. */
export function createRegistrationNoBatchOnTx(tx: TransactionClient, madrasaId: number) {
  type State = {
    id: number;
    start: number;
    end: number;
    last: number;
    pool: ReturnType<typeof createAvailableNumberPool>;
  };
  const blocks = new Map<number, State | null>();
  const dirty = new Set<State>();
  let used: Set<number> | null = null;
  let fallback: ReturnType<typeof createAvailableNumberPool> | null = null;

  async function occupied() {
    if (used == null) {
      const rows = await tx.student.findMany({
        where: { madrasaId, registrationNo: { not: null } },
        select: { registrationNo: true },
      });
      used = new Set(rows.flatMap((r) => (r.registrationNo == null ? [] : [r.registrationNo])));
    }
    return used;
  }

  async function loadBlock(classId: number) {
    if (blocks.has(classId)) return blocks.get(classId)!;
    const block = await tx.madrasaClass.findFirst({
      where: { madrasaId, classId },
      select: { id: true, regNoStart: true, regNoEnd: true, regNoLastIssued: true },
    });
    let state: State | null = null;
    if (block?.regNoStart != null && block.regNoEnd != null) {
      const start = block.regNoStart,
        end = block.regNoEnd;
      state = {
        id: block.id,
        start,
        end,
        last:
          block.regNoLastIssued != null &&
          block.regNoLastIssued >= start &&
          block.regNoLastIssued <= end
            ? block.regNoLastIssued
            : start - 1,
        pool: createAvailableNumberPool(await occupied(), start, end),
      };
    }
    blocks.set(classId, state);
    return state;
  }

  return {
    async next(classId: number): Promise<number> {
      const block = await loadBlock(classId);
      if (block) {
        const next = block.pool.next();
        if (next == null) throw new RegistrationBlockFullError(block.start, block.end);
        block.last = Math.max(block.last, next);
        dirty.add(block);
        return next;
      }
      if (!fallback) {
        const ends = await tx.madrasaClass.aggregate({
          where: { madrasaId },
          _max: { regNoEnd: true },
        });
        fallback = createAvailableNumberPool(await occupied(), (ends._max.regNoEnd ?? 0) + 1);
      }
      const next = fallback.next();
      if (next == null) throw new BadRequestError("No available registration number");
      return next;
    },
    async flush() {
      for (const block of dirty) {
        await tx.madrasaClass.update({
          where: { id: block.id },
          data: { regNoLastIssued: block.last },
        });
      }
      dirty.clear();
    },
  };
}
