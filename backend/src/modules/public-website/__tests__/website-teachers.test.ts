import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("../../../shared/database/prisma", () => ({
  prisma: { teacher: { findMany } },
}));

import { WebsiteRepository } from "../website.repository";
import { PUBLIC_TEACHERS_LIMIT } from "../website.constants";

const repository = new WebsiteRepository();
beforeEach(() => vi.resetAllMocks());

describe("public website teachers", () => {
  it("maps schema names to the public contract without exposing private fields", async () => {
    findMany.mockResolvedValue([
      { id: 4, nameBn: "Teacher", designation: "Principal", salary: 50000 },
      { id: 3, nameBn: "Another teacher", designation: null },
    ]);

    await expect(repository.findTeachersOptional(16)).resolves.toEqual([
      { id: 4, name: "Teacher", designation: "Principal", subject: null },
      { id: 3, name: "Another teacher", designation: null, subject: null },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: { madrasaId: 16, deletedAt: null },
      select: { id: true, nameBn: true, designation: true },
      orderBy: { id: "desc" },
      take: PUBLIC_TEACHERS_LIMIT,
    });
  });

  it("returns an empty list when there are no teachers", async () => {
    findMany.mockResolvedValue([]);
    await expect(repository.findTeachersOptional(16)).resolves.toEqual([]);
  });

  it("keeps the optional section from breaking the website on database failure", async () => {
    findMany.mockRejectedValue(new Error("Database unavailable"));
    await expect(repository.findTeachersOptional(16)).resolves.toEqual([]);
  });
});
