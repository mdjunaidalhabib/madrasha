import { describe, expect, it } from "vitest";
import { appendSerials } from "../serial.util";

describe("appendSerials", () => {
  it("numbers a fresh list from 0 in the given order", () => {
    const out = appendSerials([{ id: 10 }, { id: 3 }, { id: 7 }], () => null, []);
    expect(out.map((r) => [r.item.id, r.sortOrder])).toEqual([
      [10, 0],
      [3, 1],
      [7, 2],
    ]);
  });

  it("puts a new class after a division's existing 6 classes (serial 7), whatever its id", () => {
    const existing = [0, 1, 2, 3, 4, 5].map((sortOrder) => ({ parentId: 1, sortOrder }));
    const [row] = appendSerials([{ id: 2, divisionId: 1 }], (c) => c.divisionId, existing);
    expect(row.sortOrder).toBe(6); // 0-based -> displayed as ৭
  });

  it("keeps a separate sequence per parent and skips gaps safely", () => {
    const existing = [
      { parentId: 1, sortOrder: 0 },
      { parentId: 1, sortOrder: 4 },
      { parentId: 2, sortOrder: 0 },
    ];
    const out = appendSerials(
      [
        { id: 1, p: 1 },
        { id: 2, p: 2 },
        { id: 3, p: 3 },
        { id: 4, p: 1 },
      ],
      (r) => r.p,
      existing,
    );
    expect(out.map((r) => r.sortOrder)).toEqual([5, 1, 0, 6]);
  });
});
