import { describe, expect, it, vi } from "vitest";

vi.mock("../../../shared/utils/activity.util", () => ({ logActivity: vi.fn() }));

import { AccountService } from "../account.service";
import type { AccountRepository } from "../account.repository";

const entry = {
  id: 9,
  madrasaId: 2,
  type: "expense",
  receiverName: "Electricity bill",
  amount: 100,
  address: "Old address",
};
const makeRepository = () => ({
  create: vi.fn(async (data) => ({ id: 9, ...data })),
  findForTenant: vi.fn(async () => entry),
  update: vi.fn(async (_id, data) => ({ ...entry, ...data })),
});

describe("expense voucher address", () => {
  it.each([
    ["  Dhaka  ", "Dhaka"],
    [undefined, null],
  ])("persists the optional address %s", async (address, expected) => {
    const repository = makeRepository();
    await new AccountService(repository as unknown as AccountRepository).createExpense(2, 3, {
      amount: 100,
      voucher_no: "V-9",
      fund: "Operations",
      category: "Utilities",
      receiver_name: "Electricity bill",
      address,
      payment_method: "Cash",
      entry_date: "2026-11-22",
      entry_time: "10:00",
    });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        madrasaId: 2,
        type: "expense",
        receiverName: "Electricity bill",
        address: expected,
      }),
    );
  });

  it("updates an expense address and allows clearing it", async () => {
    const repository = makeRepository();
    const service = new AccountService(repository as unknown as AccountRepository);
    await service.update(2, 3, 9, { address: "  New address  " });
    expect(repository.findForTenant).toHaveBeenCalledWith(9, 2);
    expect(repository.update).toHaveBeenLastCalledWith(9, { address: "New address" });
    await service.update(2, 3, 9, { address: "" });
    expect(repository.update).toHaveBeenLastCalledWith(9, { address: null });
  });

  it("preserves the address when updating another field", async () => {
    const repository = makeRepository();
    await new AccountService(repository as unknown as AccountRepository).update(2, 3, 9, {
      note: "Updated",
    });
    expect(repository.update).toHaveBeenCalledWith(9, { note: "Updated" });
  });
});
