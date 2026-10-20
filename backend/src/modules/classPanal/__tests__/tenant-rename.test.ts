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
    await expect(service.updateClass(5, 99, { name_bn: "x" })).rejects.toThrow("শ্রেণিটি পাওয়া যায়নি");
  });

  it("requires a tenant", async () => {
    const { service, repository } = buildService(true);
    await expect(service.updateClass(undefined, 12, { name_bn: "x" })).rejects.toThrow();
    expect(repository.updateClassName).not.toHaveBeenCalled();
  });
});

describe("add / duplicate (বিভাগ · শ্রেণি · কিতাব)", () => {
  function build(institutionType: "MADRASA" | "SCHOOL" = "MADRASA") {
    const repository = {
      findMadrasaInstitutionType: vi.fn(async () => ({ institutionType })),
      createDivisionWithLink: vi.fn(async () => ({ id: 77 })),
      createAndLinkSubject: vi.fn(async () => ({ id: 5 })),
      findActiveClassForMadrasa: vi.fn(async () => ({ id: 1 })),
      duplicateSubject: vi.fn(async (_m: number, _id: number, rename: (n: string) => string) => {
        rename("কাফিয়া");
        return { bookId: 9, classId: 4 };
      }),
      duplicateClass: vi.fn(async () => null),
    };
    const reprocess = vi.fn(async () => ({ updated: 0, skipped: 0 }));
    const service = new ClassPanelService(repository as unknown as ClassPanelRepository, {
      reprocessClassResults: reprocess,
    } as never);
    return { service, repository, reprocess };
  }

  it("creates a private division using the institution's own type", async () => {
    const { service, repository } = build("SCHOOL");
    await service.addDivision(5, { name_bn: "  নতুন বিভাগ " });
    expect(repository.createDivisionWithLink).toHaveBeenCalledWith(5, "নতুন বিভাগ", "SCHOOL");
  });

  it("rejects an empty division name", async () => {
    const { service } = build();
    await expect(service.addDivision(5, { name_bn: "  " })).rejects.toThrow();
  });

  it("passes full/pass marks (Bangla-free numbers) when adding a subject", async () => {
    const { service, repository } = build();
    await service.addSubject(5, { class_id: 4, name_bn: "নাহু", full_marks: "50", pass_mark: "20" });
    expect(repository.createAndLinkSubject).toHaveBeenCalledWith(5, "নাহু", 4, { fullMark: 50, passMark: 20 });
  });

  it("rejects a pass mark above the full marks on create", async () => {
    const { service } = build();
    await expect(
      service.addSubject(5, { class_id: 4, name_bn: "নাহু", full_marks: 50, pass_mark: 60 }),
    ).rejects.toThrow();
  });

  it("duplicates a subject and refreshes that class's results", async () => {
    const { service, reprocess } = build();
    const res = await service.duplicateSubject(5, 12);
    expect(res.book_id).toBe(9);
    expect(reprocess).toHaveBeenCalledWith(5, 4);
  });

  it("404s when duplicating a class this madrasa does not have", async () => {
    const { service } = build();
    await expect(service.duplicateClass(5, 999)).rejects.toThrow("শ্রেণিটি পাওয়া যায়নি");
  });
});
