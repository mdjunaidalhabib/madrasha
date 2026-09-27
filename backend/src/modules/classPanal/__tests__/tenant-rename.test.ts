import { describe, expect, it, vi } from "vitest";

// ClassPanelService only talks to its injected repository; everything that
// would otherwise open a DB connection at import time is stubbed.
vi.mock("../../../shared/database/prisma", () => ({ prisma: {} }));
vi.mock("../../fee/exam-fee.service", () => ({ examFeeService: { syncAllExams: vi.fn() } }));
vi.mock("../../ResultPanel/result-panel.service", () => ({ resultPanelService: {} }));

import { ClassPanelService } from "../class-panel.service";
import type { ClassPanelRepository } from "../class-panel.repository";

/** Class/Division rows are a shared catalogue: a rename must only touch this
 * madrasa's own link row, never the catalogue row other madrasas also use. */
function buildService(linked: boolean) {
  const repository = {
    updateClassName: vi.fn(async () => ({ count: linked ? 1 : 0 })),
    updateDivisionName: vi.fn(async () => ({ count: linked ? 1 : 0 })),
  };
  const service = new ClassPanelService(repository as unknown as ClassPanelRepository, {} as never);
  return { service, repository };
}

describe("per-madrasa class/division rename", () => {
  it("renames a class on this madrasa's link row only", async () => {
    const { service, repository } = buildService(true);
    await service.updateClass(5, 12, { name_bn: "মিযান জামাত" });
    expect(repository.updateClassName).toHaveBeenCalledWith(5, 12, "মিযান জামাত");
  });

  it("renames a division on this madrasa's link row only", async () => {
    const { service, repository } = buildService(true);
    await service.updateDivision(5, 3, { name_bn: "কিতাব বিভাগ" });
    expect(repository.updateDivisionName).toHaveBeenCalledWith(5, 3, "কিতাব বিভাগ");
  });

  it("rejects a class this madrasa is not linked to", async () => {
    const { service } = buildService(false);
    await expect(service.updateClass(5, 99, { name_bn: "x" })).rejects.toThrow("Class not found");
  });

  it("requires a tenant", async () => {
    const { service, repository } = buildService(true);
    await expect(service.updateClass(undefined, 12, { name_bn: "x" })).rejects.toThrow();
    expect(repository.updateClassName).not.toHaveBeenCalled();
  });
});
