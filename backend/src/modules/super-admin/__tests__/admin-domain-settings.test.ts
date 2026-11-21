import { describe, expect, it, vi } from "vitest";
vi.mock("../../../shared/database/prisma", () => ({ prisma: {} }));
vi.mock("../../students/registration-block.provisioner", () => ({
  assignMissingRegistrationBlocksOnTx: vi.fn(),
}));
import { SuperAdminService } from "../superadmin.service";

function setup() {
  const tx = {};
  const repository = {
    findAdminDomainConflict: vi.fn(async (): Promise<any> => null),
    findMadrasaNameSlug: vi.fn(async () => ({ name: "Jamia", slug: "jamia", subscriptions: [] })),
    runTransaction: vi.fn(async (fn) => fn(tx)),
    updateMadrasaFieldsOnTx: vi.fn(),
    createActivityLogOnTx: vi.fn(),
  };
  return { service: new SuperAdminService(repository as any), repository, tx };
}

describe("optional institution admin domain settings", () => {
  it("saves a normalized domain for the selected institution", async () => {
    const { service, repository, tx } = setup();
    await service.updateMadrasa(7, { admin_domain: "https://ADMIN.JAMIA.COM/" });
    expect(repository.updateMadrasaFieldsOnTx).toHaveBeenCalledWith(
      tx,
      7,
      expect.objectContaining({ adminDomain: "admin.jamia.com" }),
    );
  });
  it.each(["", null])("clears the mapping when the field is %s", async (admin_domain) => {
    const { service, repository, tx } = setup();
    await service.updateMadrasa(7, { admin_domain });
    expect(repository.updateMadrasaFieldsOnTx).toHaveBeenCalledWith(
      tx,
      7,
      expect.objectContaining({ adminDomain: null }),
    );
  });
  it("leaves an existing domain untouched during unrelated updates", async () => {
    const { service, repository } = setup();
    await service.updateMadrasa(7, { name: "New name" });
    expect(repository.updateMadrasaFieldsOnTx.mock.calls[0][2]).not.toHaveProperty("adminDomain");
  });
  it.each(["invalid", "bad..example.com", "-bad.example.com", 42])(
    "rejects invalid input %s before changing data",
    async (domain) => {
      const { service, repository } = setup();
      await expect(service.updateMadrasa(7, { admin_domain: domain as any })).rejects.toThrow();
      expect(repository.runTransaction).not.toHaveBeenCalled();
    },
  );
  it("rejects an already connected hostname", async () => {
    const { service, repository } = setup();
    repository.findAdminDomainConflict.mockResolvedValue({ id: 8 });
    await expect(service.updateMadrasa(7, { admin_domain: "admin.other.com" })).rejects.toThrow();
    expect(repository.runTransaction).not.toHaveBeenCalled();
  });
});
