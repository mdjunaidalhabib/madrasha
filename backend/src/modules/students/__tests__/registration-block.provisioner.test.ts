import { describe, expect, it, vi } from "vitest";
import { assignMissingRegistrationBlocksOnTx } from "../registration-block.provisioner";

const NURANI = 1;
const HIFZ = 2;
const KITAB = 3;

const makeTx = (opts: {
  planId?: number | null;
  sizes: { divisionId: number; blockSize: number }[];
  divisionOrder: { divisionId: number; sortOrder: number }[];
  missing: { id: number; sortOrder: number; divisionId: number }[];
  maxBlockEnd?: number | null;
  maxRegNo?: number | null;
}) => {
  const update = vi.fn(async () => ({}));
  const tx = {
    $executeRaw: vi.fn(async () => 0),
    madrasaSubscription: {
      findFirst: vi.fn(async () => (opts.planId ? { planId: opts.planId } : null)),
    },
    planDivisionRegBlock: { findMany: vi.fn(async () => opts.sizes) },
    madrasaDivision: { findMany: vi.fn(async () => opts.divisionOrder) },
    madrasaClass: {
      findMany: vi.fn(async () =>
        opts.missing.map((m) => ({ id: m.id, sortOrder: m.sortOrder, class: { divisionId: m.divisionId } })),
      ),
      aggregate: vi.fn(async () => ({ _max: { regNoEnd: opts.maxBlockEnd ?? null } })),
      update,
    },
    student: { aggregate: vi.fn(async () => ({ _max: { registrationNo: opts.maxRegNo ?? null } })) },
  };
  const blocks = () =>
    update.mock.calls.map(([arg]: any) => [arg.where.id, arg.data.regNoStart, arg.data.regNoEnd]);
  return { tx: tx as any, blocks };
};

describe("assignMissingRegistrationBlocksOnTx", () => {
  it("lays out Basic-plan blocks back to back in বিভাগ → শ্রেণি order", async () => {
    const { tx, blocks } = makeTx({
      sizes: [
        { divisionId: NURANI, blockSize: 30 },
        { divisionId: HIFZ, blockSize: 40 },
        { divisionId: KITAB, blockSize: 20 },
      ],
      divisionOrder: [
        { divisionId: NURANI, sortOrder: 0 },
        { divisionId: HIFZ, sortOrder: 1 },
        { divisionId: KITAB, sortOrder: 2 },
      ],
      // Deliberately shuffled - kitab first in the query result.
      missing: [
        { id: 30, sortOrder: 0, divisionId: KITAB },
        { id: 11, sortOrder: 1, divisionId: NURANI },
        { id: 10, sortOrder: 0, divisionId: NURANI },
        { id: 20, sortOrder: 0, divisionId: HIFZ },
      ],
    });

    await expect(assignMissingRegistrationBlocksOnTx(tx, 1, 99)).resolves.toBe(4);
    expect(blocks()).toEqual([
      [10, 1, 30],
      [11, 31, 60],
      [20, 61, 100],
      [30, 101, 120],
    ]);
  });

  it("starts after existing blocks and existing student numbers", async () => {
    const { tx, blocks } = makeTx({
      sizes: [{ divisionId: KITAB, blockSize: 20 }],
      divisionOrder: [{ divisionId: KITAB, sortOrder: 0 }],
      missing: [{ id: 30, sortOrder: 5, divisionId: KITAB }],
      maxBlockEnd: 120,
      maxRegNo: 250,
    });
    await assignMissingRegistrationBlocksOnTx(tx, 1, 99);
    expect(blocks()).toEqual([[30, 251, 270]]);
  });

  it("uses the active subscription's plan when none is passed", async () => {
    const { tx } = makeTx({ planId: 7, sizes: [], divisionOrder: [], missing: [] });
    await assignMissingRegistrationBlocksOnTx(tx, 1);
    expect(tx.planDivisionRegBlock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { planId: 7, blockSize: { gt: 0 } } }),
    );
  });

  it("does nothing without a plan", async () => {
    const { tx, blocks } = makeTx({ planId: null, sizes: [], divisionOrder: [], missing: [] });
    await expect(assignMissingRegistrationBlocksOnTx(tx, 1)).resolves.toBe(0);
    expect(tx.planDivisionRegBlock.findMany).not.toHaveBeenCalled();
    expect(blocks()).toEqual([]);
  });
});
