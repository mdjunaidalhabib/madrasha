import { describe, expect, it, vi } from "vitest";
const { transaction } = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("../../../shared/database/prisma", () => ({ prisma: { $transaction: transaction } }));
import { PlansRepository } from "../plans.repository";

function fixture() {
  const rows = [1, 2, 3, 4].map((id) => ({ id, name: `Plan ${id}`, sortOrder: id, isActive: id === 2 ? 0 : 1, deletedAt: null as Date | null }));
  const tx = {
    $executeRaw: vi.fn(),
    plan: {
      findMany: vi.fn(async () => rows.filter((r) => !r.deletedAt).map((r) => ({ id: r.id, sortOrder: r.sortOrder })).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)),
      findFirst: vi.fn(async ({ where }) => rows.find((r) => r.id === where.id && !r.deletedAt)),
      update: vi.fn(async ({ where, data }) => Object.assign(rows.find((r) => r.id === where.id)!, data)),
      updateMany: vi.fn(async ({ where, data }) => {
        const found = rows.find((r) => r.id === where.id && (where.deletedAt === null ? !r.deletedAt : !!r.deletedAt));
        if (!found) return { count: 0 };
        Object.assign(found, data);
        return { count: 1 };
      }),
      create: vi.fn(async ({ data }) => {
        const row = { id: 5, sortOrder: 0, isActive: 1, deletedAt: null, ...data };
        rows.push(row);
        return row;
      }),
    },
  };
  transaction.mockImplementation(async (fn) => {
    const snapshot = rows.map((r) => ({ ...r }));
    try { return await fn(tx); }
    catch (error) { rows.splice(0, rows.length, ...snapshot); throw error; }
  });
  const order = () => rows.filter((r) => !r.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder).map((r) => r.id);
  return { rows, tx, order, repository: new PlansRepository() };
}

describe("automatic plan positions", () => {
  it.each([[4, 1, [4, 1, 2, 3]], [1, 3, [2, 3, 1, 4]], [2, 99, [1, 3, 4, 2]]])("moves plan %i to %i while shifting every other tier", async (id, position, expected) => {
    const { repository, rows, order, tx } = fixture();
    await repository.updateActiveById(id as number, { sortOrder: position as number });
    expect(order()).toEqual(expected);
    expect(rows.map((r) => r.sortOrder).sort()).toEqual([1, 2, 3, 4]);
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.plan.updateMany.mock.invocationCallOrder[0]);
  });
  it("appends a new automatic plan and inserts a chosen position", async () => {
    const first = fixture();
    await first.repository.create({ name: "New", studentLimit: 50 });
    expect(first.order()).toEqual([1, 2, 3, 4, 5]);
    const second = fixture();
    await second.repository.create({ name: "New", studentLimit: 50, sortOrder: 2 });
    expect(second.order()).toEqual([1, 5, 2, 3, 4]);
  });
  it("closes a trashed plan's gap and appends a restored tier", async () => {
    const { repository, order, rows } = fixture();
    await repository.softDelete(2);
    expect(order()).toEqual([1, 3, 4]);
    expect(rows.find((r) => r.id === 4)?.sortOrder).toBe(3);
    await repository.restore(2);
    expect(order()).toEqual([1, 3, 4, 2]);
  });
  it("rolls back the whole move if a shifted row fails", async () => {
    const { repository, tx, order } = fixture();
    tx.plan.update.mockRejectedValueOnce(new Error("Write failed"));
    await expect(repository.updateActiveById(4, { sortOrder: 1 })).rejects.toThrow("Write failed");
    expect(order()).toEqual([1, 2, 3, 4]);
  });
});
