import { afterEach, describe, expect, it, vi } from "vitest";
import { SidebarService } from "../sidebar.service";
import { feeService } from "../../fee/fee.service";

afterEach(() => vi.restoreAllMocks());

function setup({ permissions = ["website.manage"], website = true } = {}) {
  vi.spyOn(feeService, "getAdmissionCategoryNames").mockResolvedValue([]);
  const repository = {
    findRoleById: vi.fn().mockResolvedValue({ keyName: "admin" }),
    findRolePermissionKeys: vi.fn().mockResolvedValue(permissions.map((keyName) => ({ permission: { keyName } }))),
    findActiveMadrasaModules: vi.fn().mockResolvedValue([
      { module: { id: 1, keyName: "settings", nameBn: "Settings", groupName: "core", sortOrder: 20 } },
      ...(website ? [{ module: { id: 2, keyName: "website", nameBn: "Website", groupName: "core", sortOrder: 19 } }] : []),
    ]),
    findFeaturesByModuleIds: vi.fn().mockResolvedValue([]),
    countPendingAdmissions: vi.fn().mockResolvedValue(0), countRejectedAdmissions: vi.fn().mockResolvedValue(0),
    countPendingFeeStudents: vi.fn().mockResolvedValue(0), countOverdueFeeStudents: vi.fn().mockResolvedValue(0),
  };
  return { repository, service: new SidebarService(repository as any) };
}

describe("donations inside website settings", () => {
  it("keeps website settings in the hub without a standalone donation menu", async () => {
    const { service } = setup();
    const tree = await service.getSidebarTree(42, 3);
    expect(tree.some((item) => item.key === "donations")).toBe(false);
    expect(tree.find((item) => item.key === "settings")?.children.some((item) => item.key === "website")).toBe(true);
  });
  it.each([
    { permissions: [] }, { website: false },
  ])("never adds a separate donation menu: %j", async (options) => {
    const { service } = setup(options);
    expect((await service.getSidebarTree(42, 3)).some((item) => item.key === "donations")).toBe(false);
  });
  it("filters any legacy standalone donation module", async () => {
    const { service, repository } = setup();
    repository.findActiveMadrasaModules.mockResolvedValue([{ module: { id: 4, keyName: "donations", nameBn: "Donations", groupName: "core", sortOrder: 10 } }]);
    expect((await service.getSidebarTree(42, 3)).some((item) => item.key === "donations")).toBe(false);
  });
});
