import { describe, expect, it, vi } from "vitest";

// Both services only talk to their injected repository here; the prisma
// client import is stubbed so nothing opens a DB connection.
vi.mock("../../../shared/database/prisma", () => ({ prisma: {} }));

import { TeacherService } from "../teacher.service";
import { StaffService } from "../../staff/staff.service";
import { teacherNamesBulkSchema } from "../teacher.validation";
import { staffNamesBulkSchema } from "../../staff/staff.validation";
import { BadRequestError } from "../../../shared/errors";

const makeRepo = (tenantIds: number[]) => {
  const tx = { marker: "tx" };
  const repo = {
    findIdsForTenant: vi.fn(async (_m: number, ids: number[]) =>
      ids.filter((id) => tenantIds.includes(id)).map((id) => ({ id })),
    ),
    updateManyForTenantOnTx: vi.fn(async () => ({ count: 1 })),
    runTransaction: vi.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)),
  };
  return { repo, tx };
};

describe.each([
  ["TeacherService", (repo: unknown) => new TeacherService(repo as any)],
  ["StaffService", (repo: unknown) => new StaffService(repo as any)],
])("%s.updateNamesBulk", (_label, build) => {
  it("writes only the provided name columns, trimmed, in one transaction", async () => {
    const { repo, tx } = makeRepo([1, 2]);
    await expect(
      build(repo).updateNamesBulk(9, [
        { id: 1, name_bn: " করিম ", name_ar: "كريم", name_en: "" },
        { id: 2, name_en: " Karim " },
      ]),
    ).resolves.toEqual({ updated: 2 });

    expect(repo.runTransaction).toHaveBeenCalledTimes(1);
    expect(repo.updateManyForTenantOnTx).toHaveBeenNthCalledWith(1, tx, 1, 9, {
      nameBn: "করিম",
      nameAr: "كريم",
      nameEn: null,
    });
    expect(repo.updateManyForTenantOnTx).toHaveBeenNthCalledWith(2, tx, 2, 9, { nameEn: "Karim" });
  });

  it("rejects the whole batch if any id is outside the madrasa", async () => {
    const { repo } = makeRepo([1]);
    await expect(build(repo).updateNamesBulk(9, [{ id: 1 }, { id: 77, name_en: "B" }])).rejects.toBeInstanceOf(
      BadRequestError,
    );
    expect(repo.runTransaction).not.toHaveBeenCalled();
  });
});

describe.each([
  ["teacherNamesBulkSchema", teacherNamesBulkSchema],
  ["staffNamesBulkSchema", staffNamesBulkSchema],
])("%s", (_label, schema) => {
  const parse = (items: unknown) => schema.safeParse({ body: { items } }).success;

  it("accepts only name fields and enforces limits", () => {
    expect(parse([{ id: 1, name_bn: "ক", name_ar: null, name_en: "A" }])).toBe(true);
    expect(parse([{ id: 1, phone: "017" }])).toBe(false);
    expect(parse([{ id: 1, name_bn: "" }])).toBe(false);
    expect(parse([])).toBe(false);
    expect(parse([{ id: 1 }, { id: 1 }])).toBe(false);
    expect(parse(Array.from({ length: 501 }, (_, i) => ({ id: i + 1 })))).toBe(false);
  });
});
