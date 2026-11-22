import { describe, expect, it, vi } from "vitest";
vi.mock("../../../shared/database/prisma", () => ({ prisma: {} }));
import { TeacherService } from "../teacher.service";

describe("teacher permanent registration numbers", () => {
  const setup = () => {
    const tx = {};
    const repo = {
      runTransaction: vi.fn(async (fn: any) => fn(tx)),
      lockRegistrationScopeOnTx: vi.fn(async () => {}),
      getRegistrationNumbersOnTx: vi.fn(async () => [1, 3]),
      createOnTx: vi.fn(async (_tx: unknown, data: any) => ({ id: 100 + data.registrationNo })),
      findByNidOnTx: vi.fn(async (_tx: unknown, _tenant: number, nid: string) =>
        nid === "existing" ? { id: 1, nameBn: "Existing" } : null,
      ),
      updateOnTx: vi.fn(async () => ({})),
    };
    return { repo, tx, service: new TeacherService(repo as any) };
  };
  it("continues above issued numbers under the tenant lock", async () => {
    const { repo, tx, service } = setup();
    await service.createTeacher({ name_bn: "New", academic_division: 10 }, 7);
    expect(repo.lockRegistrationScopeOnTx).toHaveBeenCalledWith(tx, 7);
    expect(repo.createOnTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ madrasaId: 7, registrationNo: 4 }),
    );
  });
  it("keeps bulk allocations unique and does not allocate a number for NID updates", async () => {
    const { repo, service } = setup();
    await service.bulkCreateTeachers(
      [
        { name_bn: "First", academic_division: 10 },
        { name_bn: "Existing", academic_division: 10, nid: "existing" },
        { name_bn: "Next", academic_division: 10 },
      ],
      7,
    );
    expect(repo.createOnTx.mock.calls.map((call) => call[1].registrationNo)).toEqual([4, 5]);
  });
});
