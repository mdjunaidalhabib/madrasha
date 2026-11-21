import { describe, expect, it, vi } from "vitest";

vi.mock("../../../shared/database/prisma", () => ({ prisma: {} }));
import { StaffService } from "../staff.service";
import { BadRequestError, TenantNotResolvedError } from "../../../shared/errors";

function setup() {
  const tx = { transaction: true };
  const repo = {
    runTransaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
    lockRegistrationScopeOnTx: vi.fn(async () => {}),
    getRegistrationNumbersOnTx: vi.fn(async () => Array.from({ length: 40 }, (_, i) => i + 1)),
    findByNidOnTx: vi.fn(async (_tx, _tenant, nid) => (nid === "existing" ? { id: 7 } : null)),
    createOnTx: vi.fn(async (_tx, data) => ({ id: data.registrationNo })),
    updateManyForTenantOnTx: vi.fn(async () => ({ count: 1 })),
  };
  return { tx, repo, service: new StaffService(repo as any) };
}

describe("staff bulk admission", () => {
  it("fills hard-deleted registration holes without consuming a number for an update", async () => {
    const { repo, service } = setup();
    repo.getRegistrationNumbersOnTx.mockResolvedValue([1, 3]);
    await service.bulkCreateStaff([{ name_bn: "New" }, { name_bn: "Existing", nid: "existing" }, { name_bn: "Next" }], 9);
    expect(repo.createOnTx.mock.calls.map((call) => call[1].registrationNo)).toEqual([2, 4]);
  });
  it("allocates consecutive registration numbers and updates NID matches within the tenant transaction", async () => {
    const { tx, repo, service } = setup();
    const result = await service.bulkCreateStaff(
      [
        { name_bn: "First", nid: "001", phone: "017 123" },
        { name_bn: "Existing", nid: "existing" },
        { name_bn: "Last" },
      ],
      9,
    );
    expect(repo.runTransaction).toHaveBeenCalledTimes(1);
    expect(repo.lockRegistrationScopeOnTx).toHaveBeenCalledWith(tx, 9);
    expect(repo.findByNidOnTx).toHaveBeenCalledWith(tx, 9, "001");
    expect(repo.createOnTx).toHaveBeenNthCalledWith(
      1,
      tx,
      expect.objectContaining({ madrasaId: 9, registrationNo: 41, nid: "001", phone: "017123" }),
    );
    expect(repo.createOnTx).toHaveBeenNthCalledWith(
      2,
      tx,
      expect.objectContaining({ madrasaId: 9, registrationNo: 42 }),
    );
    expect(repo.updateManyForTenantOnTx).toHaveBeenCalledWith(
      tx,
      7,
      9,
      expect.objectContaining({ nameBn: "Existing" }),
    );
    expect(result).toMatchObject({
      inserted: 2,
      updated: 1,
      preview: [
        { row: 2, action: "create", name: "First" },
        { row: 3, action: "update", id: 7 },
        { row: 4, action: "create", name: "Last" },
      ],
    });
  });

  it("requires a tenant before any database access", async () => {
    const { repo, service } = setup();
    await expect(service.bulkCreateStaff([{ name_bn: "A" }], undefined)).rejects.toBeInstanceOf(
      TenantNotResolvedError,
    );
    expect(repo.runTransaction).not.toHaveBeenCalled();
  });

  it.each([
    { rows: [] },
    { rows: [null] },
    { rows: [{ name_bn: 123 }] },
    { rows: [{ name_bn: "A" }, { name_bn: " " }] },
    { rows: Array.from({ length: 1001 }, () => ({ name_bn: "A" })) },
  ])("rejects invalid batches before writing any row (%#)", async ({ rows }) => {
    const { repo, service } = setup();
    await expect(service.bulkCreateStaff(rows as any, 9)).rejects.toBeInstanceOf(BadRequestError);
    expect(repo.runTransaction).not.toHaveBeenCalled();
  });

  it("propagates a write failure out of the transaction instead of reporting partial success", async () => {
    const { repo, service } = setup();
    repo.createOnTx.mockRejectedValueOnce(new Error("write failed"));
    await expect(service.bulkCreateStaff([{ name_bn: "A" }], 9)).rejects.toThrow("write failed");
  });
});
