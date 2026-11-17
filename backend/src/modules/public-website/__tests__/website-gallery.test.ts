import { describe, expect, it, vi } from "vitest";
import { WebsiteService } from "../website.service";

describe("gallery save response", () => {
  it("returns the created image using the same fields as the gallery list", async () => {
    const row = { id: 7, title: "Campus", imageUrl: "/campus.jpg", isPublished: 1, sortOrder: 3 };
    const repo = { createGalleryItem: vi.fn().mockResolvedValue(row) };
    const service = new WebsiteService(repo as any);

    await expect(service.saveWebsiteGalleryItem(2, {
      title: "Campus", image_url: "/campus.jpg", sort_order: 3,
    })).resolves.toEqual({
      id: 7, title: "Campus", image_url: "/campus.jpg", is_published: 1, sort_order: 3,
    });
  });

  it("returns the edited image rather than the most recently added image", async () => {
    const repo = {
      updateGalleryItem: vi.fn().mockResolvedValue({ count: 1 }),
      findGalleryItem: vi.fn().mockResolvedValue({
        id: 3, title: "Updated", imageUrl: "/updated.jpg", isPublished: 0, sortOrder: 1,
      }),
      findLatestGalleryItem: vi.fn(),
    };
    const service = new WebsiteService(repo as any);
    await expect(service.saveWebsiteGalleryItem(2, {
      id: 3, title: "Updated", image_url: "/updated.jpg", is_published: 0, sort_order: 1,
    })).resolves.toEqual({
      id: 3, title: "Updated", image_url: "/updated.jpg", is_published: 0, sort_order: 1,
    });
    expect(repo.findGalleryItem).toHaveBeenCalledWith(3, 2);
    expect(repo.findLatestGalleryItem).not.toHaveBeenCalled();
  });

  it("rejects an update outside the institution instead of returning another image", async () => {
    const repo = {
      updateGalleryItem: vi.fn().mockResolvedValue({ count: 0 }),
      findGalleryItem: vi.fn(),
    };
    await expect(new WebsiteService(repo as any).saveWebsiteGalleryItem(2, {
      id: 99, image_url: "/other.jpg",
    })).rejects.toThrow("Gallery item not found");
    expect(repo.findGalleryItem).not.toHaveBeenCalled();
  });
});
