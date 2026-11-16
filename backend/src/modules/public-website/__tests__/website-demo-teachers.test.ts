import { describe, expect, it, vi } from "vitest";
import { DEFAULT_WEBSITE_DEMO_TEACHERS, publicDemoTeachers } from "../website-demo-teachers";

vi.mock("../../../shared/subscription/subscription-state", () => ({ getSubscriptionState: vi.fn(async () => "ACTIVE") }));
vi.mock("../../classPanal/class-panel.service", () => ({ classPanelService: { listDivisions: vi.fn(async () => []) } }));
import { WebsiteService } from "../website.service";

const makeRepository = (teachers: any[], demoTeachers: unknown) => ({
  findPublicMadrasaBySlug: vi.fn(async () => ({ id: 42, name: "Demo", slug: "demo", isActive: 1, websiteStatus: "active" })),
  findSettings: vi.fn(async () => ({ isPublished: 1, demoTeachers })),
  findTeachersOptional: vi.fn(async () => teachers),
  findPublishedPages: vi.fn(async () => []),
  findPublishedNotices: vi.fn(async () => []),
  findPublishedGallery: vi.fn(async () => []),
  findPublishedSlides: vi.fn(async () => []),
  findPublishedCommittee: vi.fn(async () => []),
  findPublishedVideos: vi.fn(async () => []),
});

describe("website sample teacher profiles", () => {
  it("shows actual teachers instead of sample profiles when actual records exist", async () => {
    const real = [{ id: 1, name: "Actual teacher" }];
    const repository = makeRepository(real, DEFAULT_WEBSITE_DEMO_TEACHERS);
    const result = await new WebsiteService(repository as any).getPublicWebsite("demo");
    expect(result.teachers).toEqual(real);
    expect(repository.findTeachersOptional).toHaveBeenCalledWith(42);
  });

  it("uses only this institution's published sample profiles when the teacher list is empty", async () => {
    const profiles = structuredClone(DEFAULT_WEBSITE_DEMO_TEACHERS);
    profiles[0].isPublished = 0;
    const repository = makeRepository([], profiles);
    const result = await new WebsiteService(repository as any).getPublicWebsite("demo");
    expect(result.teachers).toHaveLength(3);
    expect(result.teachers.every((row: any) => row.is_demo === true)).toBe(true);
    expect(repository.findSettings).toHaveBeenCalledWith(42);
    expect(result.teachers.some((row: any) => row.name === profiles[0].name)).toBe(false);
  });

  it("keeps an intentionally empty sample list empty", async () => {
    const result = await new WebsiteService(makeRepository([], []) as any).getPublicWebsite("demo");
    expect(result.teachers).toEqual([]);
  });

  it.each([undefined, {}, [{ ...DEFAULT_WEBSITE_DEMO_TEACHERS[0], photoUrl: "javascript:alert(1)" }]])("rejects missing or malformed stored profiles", (value) => {
    expect(publicDemoTeachers(value)).toEqual([]);
  });
});
