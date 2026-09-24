import { describe, expect, it, vi } from "vitest";
import {
  allocateStudentRegistrationNoOnTx,
  RegistrationBlockFullError,
} from "../registration-no.allocator";

type Block = { id: number; regNoStart: number | null; regNoEnd: number | null; regNoLastIssued: number | null };

/** Minimal fake of the Prisma tx calls the allocator makes. */
const makeTx = (opts: { block: Block | null; regNos: number[]; maxBlockEnd?: number | null }) => {
  const update = vi.fn(async () => ({}));
  const tx = {
    madrasaClass: {
      findFirst: vi.fn(async () => opts.block),
      update,
      aggregate: vi.fn(async () => ({ _max: { regNoEnd: opts.maxBlockEnd ?? null } })),
    },
    student: {
      aggregate: vi.fn(async ({ where }: any) => {
        const range = where.registrationNo;
        const inRange = opts.regNos.filter((n) => !range || (n >= range.gte && n <= range.lte));
        return { _max: { registrationNo: inRange.length ? Math.max(...inRange) : null } };
      }),
    },
  };
  return { tx: tx as any, update };
};

describe("allocateStudentRegistrationNoOnTx", () => {
  it("starts an empty block at its first number", async () => {
    const { tx, update } = makeTx({
      block: { id: 7, regNoStart: 51, regNoEnd: 100, regNoLastIssued: null },
      regNos: [1, 2, 3, 120],
    });
    await expect(allocateStudentRegistrationNoOnTx(tx, 1, 5)).resolves.toBe(51);
    expect(update).toHaveBeenCalledWith({ where: { id: 7 }, data: { regNoLastIssued: 51 } });
  });

  it("continues after the highest number used inside the block", async () => {
    const { tx } = makeTx({
      block: { id: 7, regNoStart: 1, regNoEnd: 50, regNoLastIssued: 10 },
      regNos: [3, 12, 51, 70],
    });
    await expect(allocateStudentRegistrationNoOnTx(tx, 1, 5)).resolves.toBe(13);
  });

  it("never reuses a number freed by a promoted student", async () => {
    // 20 was issued, its holder was promoted out of the block.
    const { tx } = makeTx({
      block: { id: 7, regNoStart: 1, regNoEnd: 50, regNoLastIssued: 20 },
      regNos: [1, 2, 19],
    });
    await expect(allocateStudentRegistrationNoOnTx(tx, 1, 5)).resolves.toBe(21);
  });

  it("ignores a last-issued value outside a since-changed block", async () => {
    const { tx } = makeTx({
      block: { id: 7, regNoStart: 101, regNoEnd: 150, regNoLastIssued: 30 },
      regNos: [30],
    });
    await expect(allocateStudentRegistrationNoOnTx(tx, 1, 5)).resolves.toBe(101);
  });

  it("refuses once the block is used up", async () => {
    const { tx, update } = makeTx({
      block: { id: 7, regNoStart: 1, regNoEnd: 3, regNoLastIssued: 3 },
      regNos: [1, 2, 3],
    });
    await expect(allocateStudentRegistrationNoOnTx(tx, 1, 5)).rejects.toBeInstanceOf(RegistrationBlockFullError);
    expect(update).not.toHaveBeenCalled();
  });

  it("without a block, goes past every student number and every block", async () => {
    const { tx } = makeTx({ block: null, regNos: [5, 40], maxBlockEnd: 100 });
    await expect(allocateStudentRegistrationNoOnTx(tx, 1, 5)).resolves.toBe(101);

    const noBlocks = makeTx({ block: null, regNos: [5, 40] });
    await expect(allocateStudentRegistrationNoOnTx(noBlocks.tx, 1, 5)).resolves.toBe(41);
  });
});
