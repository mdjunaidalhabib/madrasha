import { describe, expect, it, vi } from "vitest";
const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../../database/prisma", () => ({ prisma: { $queryRaw: query } }));
import { findReferencedImageKeys } from "../image-references";

describe("image reference inventory", () => {
  it("checks JSON, template versions, snapshots and trash rows without relying on public image domains", async () => {
    const key = "madrasas/demo/students/test.webp";
    query.mockResolvedValueOnce([{ key }]);
    expect(await findReferencedImageKeys([key])).toEqual(new Set([key]));
    const sql = query.mock.calls[0][0];
    expect(sql.sql).toContain('"document_template_versions"');
    expect(sql.sql).toContain('"students"');
    expect(sql.sql).toContain('"staff"');
    expect(sql.sql).toContain('"background"::text');
    expect(sql.sql).not.toContain('"activity_logs"');
    expect(sql.sql).not.toContain('"deleted_at" IS NULL');
    expect(sql.values).toEqual([key]);
  });
});
