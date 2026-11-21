import { describe, expect, it, vi } from "vitest";
const { staff } = vi.hoisted(() => ({
  staff: { findMany: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
}));
vi.mock("../../../shared/database/prisma", () => ({ prisma: { staff } }));
vi.mock("../../ResultPanel/result-panel.repository", () => ({ resultPanelRepository: {} }));
import { TrashRepository } from "../trash.repository";
import { TrashService } from "../trash.service";

describe("staff trash lifecycle", () => {
  it("scopes list, restore and permanent deletion to trashed staff of the institution", async () => {
    const repo = new TrashRepository();
    staff.findMany.mockResolvedValue([]);
    staff.updateMany.mockResolvedValue({ count: 1 });
    staff.deleteMany.mockResolvedValue({ count: 1 });
    await repo.findTrashedStaff(7);
    expect(staff.findMany).toHaveBeenCalledWith({
      where: { madrasaId: 7, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
    });
    await repo.restoreStaff(10, 7);
    expect(staff.updateMany).toHaveBeenCalledWith({
      where: { id: 10, madrasaId: 7, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    await repo.permanentDeleteStaff(10, 7);
    expect(staff.deleteMany).toHaveBeenCalledWith({
      where: { id: 10, madrasaId: 7, deletedAt: { not: null } },
    });
  });
  it("keeps the registration number in trash and rejects missing or foreign records", async () => {
    const repo = {
      findTrashedStaff: vi.fn(async () => [
        { id: 10, nameBn: "Staff", registrationNo: 2, deletedAt: new Date() },
      ]),
      restoreStaff: vi.fn(async () => ({ count: 0 })),
      permanentDeleteStaff: vi.fn(async () => ({ count: 0 })),
    };
    const service = new TrashService(repo as any);
    expect((await service.listStaff(7))[0]).toMatchObject({ id: 10, registration_no: 2 });
    await expect(service.restoreStaff(10, 7)).rejects.toThrow();
    await expect(service.permanentDeleteStaff(10, 7)).rejects.toThrow();
  });
});
