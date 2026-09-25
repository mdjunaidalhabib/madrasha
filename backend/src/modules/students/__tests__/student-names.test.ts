import { describe, expect, it, vi } from "vitest";

// StudentService only talks to its injected repository here; everything that
// would otherwise open a DB connection / pull heavy modules at import time is stubbed.
vi.mock("../../../shared/database/prisma", () => ({ prisma: {} }));
vi.mock("../../guardian/guardian.service", () => ({ guardianService: {} }));
vi.mock("../../fee/fee.service", () => ({ feeService: {} }));
vi.mock("../../notifications/notification.service", () => ({ notificationService: {} }));
vi.mock("../../../shared/utils/activity.util", () => ({ logActivity: vi.fn() }));

import { StudentService } from "../student.service";
import { TenantNotResolvedError } from "../student.types";
import { BadRequestError } from "../../../shared/errors";
import { studentNamesBulkSchema } from "../student.validation";

const makeService = (tenantIds: number[]) => {
  const tx = { marker: "tx" };
  const repo = {
    findIdsForTenant: vi.fn(async (_m: number, ids: number[]) =>
      ids.filter((id) => tenantIds.includes(id)).map((id) => ({ id })),
    ),
    updateManyForTenantOnTx: vi.fn(async () => ({ count: 1 })),
    runTransaction: vi.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)),
  };
  return { service: new StudentService(repo as any), repo, tx };
};

describe("StudentService.updateNamesBulk", () => {
  it("writes only the name columns, trimmed, tenant-scoped, in one transaction", async () => {
    const { service, repo, tx } = makeService([1, 2]);
    await expect(
      service.updateNamesBulk(9, [
        { id: 1, name_bn: "  আব্দুল্লাহ ", arabic_name: "عبد الله", name_en: "" },
        { id: 2, father_name_en: " Abdur Rahman " },
      ]),
    ).resolves.toEqual({ updated: 2 });

    expect(repo.runTransaction).toHaveBeenCalledTimes(1);
    expect(repo.updateManyForTenantOnTx).toHaveBeenNthCalledWith(1, tx, 1, 9, {
      nameBn: "আব্দুল্লাহ",
      arabicName: "عبد الله",
      nameEn: null,
    });
    expect(repo.updateManyForTenantOnTx).toHaveBeenNthCalledWith(2, tx, 2, 9, { fatherNameEn: "Abdur Rahman" });
  });

  it("rejects the whole batch if any id is outside the madrasa", async () => {
    const { service, repo } = makeService([1]);
    await expect(service.updateNamesBulk(9, [{ id: 1, name_en: "A" }, { id: 77, name_en: "B" }])).rejects.toBeInstanceOf(
      BadRequestError,
    );
    expect(repo.runTransaction).not.toHaveBeenCalled();
  });

  it("never blanks the required Bangla name", async () => {
    const { service, repo } = makeService([1]);
    await expect(service.updateNamesBulk(9, [{ id: 1, name_bn: "   " }])).rejects.toBeInstanceOf(BadRequestError);
    expect(repo.runTransaction).not.toHaveBeenCalled();
  });

  it("requires a tenant", async () => {
    const { service } = makeService([1]);
    await expect(service.updateNamesBulk(undefined, [{ id: 1 }])).rejects.toBeInstanceOf(TenantNotResolvedError);
  });
});

describe("studentNamesBulkSchema", () => {
  const parse = (items: unknown) => studentNamesBulkSchema.safeParse({ body: { items } }).success;

  it("accepts name fields only", () => {
    expect(parse([{ id: 1, name_bn: "ক", arabic_name: null, mother_name_en: "M" }])).toBe(true);
    expect(parse([{ id: 1, roll: 5 }])).toBe(false);
    expect(parse([{ id: 1, guardian_phone: "017" }])).toBe(false);
  });

  it("enforces limits, required bangla and unique ids", () => {
    expect(parse([])).toBe(false);
    expect(parse([{ id: 1, name_bn: "" }])).toBe(false);
    expect(parse([{ id: 1, name_en: "x".repeat(201) }])).toBe(false);
    expect(parse([{ id: 1 }, { id: 1 }])).toBe(false);
    expect(parse(Array.from({ length: 501 }, (_, i) => ({ id: i + 1 })))).toBe(false);
  });
});
