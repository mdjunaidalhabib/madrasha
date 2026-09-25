import { describe, expect, it, vi } from "vitest";

// StudentService only talks to its injected repository here; everything that
// would otherwise open a DB connection / pull heavy modules at import time is stubbed.
vi.mock("../../../shared/database/prisma", () => ({ prisma: {} }));
vi.mock("../../guardian/guardian.service", () => ({ guardianService: {} }));
vi.mock("../../fee/fee.service", () => ({ feeService: {} }));
vi.mock("../../notifications/notification.service", () => ({ notificationService: {} }));
vi.mock("../../../shared/utils/activity.util", () => ({ logActivity: vi.fn() }));

import { StudentService } from "../student.service";
import { StudentNotFoundError, TenantNotResolvedError } from "../student.types";
import { studentPhotoSchema } from "../student.validation";

const makeService = (count = 1) => {
  const setImage = vi.fn(async () => ({ count }));
  const service = new StudentService({ setImage } as any);
  return { service, setImage };
};

describe("StudentService.setPhoto", () => {
  it("updates only the image column, scoped to the tenant", async () => {
    const { service, setImage } = makeService();
    await expect(service.setPhoto(5, 9, " https://cdn.x/a.jpg ")).resolves.toEqual({
      id: 5,
      image: "https://cdn.x/a.jpg",
    });
    expect(setImage).toHaveBeenCalledWith(5, 9, "https://cdn.x/a.jpg");
  });

  it("treats null / empty string as remove", async () => {
    const { service, setImage } = makeService();
    await service.setPhoto(5, 9, "");
    await service.setPhoto(5, 9, null);
    expect(setImage).toHaveBeenNthCalledWith(1, 5, 9, null);
    expect(setImage).toHaveBeenNthCalledWith(2, 5, 9, null);
  });

  it("404s when the student isn't in this madrasa", async () => {
    const { service } = makeService(0);
    await expect(service.setPhoto(5, 9, "https://cdn.x/a.jpg")).rejects.toBeInstanceOf(StudentNotFoundError);
  });

  it("requires a tenant", async () => {
    const { service, setImage } = makeService();
    await expect(service.setPhoto(5, undefined, null)).rejects.toBeInstanceOf(TenantNotResolvedError);
    expect(setImage).not.toHaveBeenCalled();
  });
});

describe("studentPhotoSchema", () => {
  const parse = (image: unknown) =>
    studentPhotoSchema.safeParse({ params: { id: "3" }, body: { image } }).success;

  it("accepts hosted URLs, data-URIs, empty and null", () => {
    expect(parse("https://res.cloudinary.com/x.jpg")).toBe(true);
    expect(parse("data:image/jpeg;base64,AAAA")).toBe(true);
    expect(parse("")).toBe(true);
    expect(parse(null)).toBe(true);
  });

  it("rejects anything else", () => {
    expect(parse("javascript:alert(1)")).toBe(false);
    expect(parse(undefined)).toBe(false);
    expect(parse(42)).toBe(false);
  });
});
