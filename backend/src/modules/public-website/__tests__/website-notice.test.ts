import { describe, expect, it, vi } from "vitest";
import { WebsiteService } from "../website.service";

describe("notice save response", () => {
  const row = { id: 3, title: "Updated", content: "Details", isPublished: 0, publishedAt: null };
  it("returns the edited notice in the list's API format", async () => {
    const repo = { updateNotice: vi.fn().mockResolvedValue({ count: 1 }), findNoticeById: vi.fn().mockResolvedValue(row), findLatestNotice: vi.fn() };
    await expect(new WebsiteService(repo as any).saveWebsiteNotice(42, { id: 3, title: "Updated", content: "Details", is_published: 0 })).resolves.toEqual({ id: 3, title: "Updated", content: "Details", is_published: 0, published_at: null });
    expect(repo.findNoticeById).toHaveBeenCalledWith(3, 42);
    expect(repo.findLatestNotice).not.toHaveBeenCalled();
  });
  it("returns the created notice directly", async () => {
    const repo = { createNotice: vi.fn().mockResolvedValue(row) };
    await expect(new WebsiteService(repo as any).saveWebsiteNotice(42, { title: "Updated" })).resolves.toMatchObject({ id: 3, title: "Updated", is_published: 0 });
  });
  it("rejects updates to a missing or other institution's notice", async () => {
    const repo = { updateNotice: vi.fn().mockResolvedValue({ count: 0 }), findNoticeById: vi.fn() };
    await expect(new WebsiteService(repo as any).saveWebsiteNotice(42, { id: 3, title: "Updated" })).rejects.toThrow("Notice not found");
    expect(repo.findNoticeById).not.toHaveBeenCalled();
  });
});
