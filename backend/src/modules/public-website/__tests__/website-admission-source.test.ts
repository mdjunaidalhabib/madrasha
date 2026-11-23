import { describe, expect, it, vi } from "vitest";
vi.mock("../../uploads/upload.service", () => ({ uploadService: { uploadImage: vi.fn(async () => ({ url: "https://cdn.example.com/photo.webp" })) } }));

vi.mock("../../../shared/subscription/subscription-state", () => ({ getSubscriptionState: vi.fn(async () => "ACTIVE") }));
vi.mock("../../students/student.service", () => ({ studentService: { admitStudent: vi.fn(async () => ({ admissionStatus: "PENDING" })) } }));

import { studentService } from "../../students/student.service";
import { WebsiteService } from "../website.service";
import { uploadService } from "../../uploads/upload.service";

describe("public admission source", () => {
  it("uploads anonymous applicant photos before creating the student", async () => {
    const repository = { findPublicMadrasaBySlug: vi.fn(async () => ({ id: 42, isActive: 1, websiteStatus: "active" })) };
    await new WebsiteService(repository as any).submitFullAdmissionApplication("demo", { image: "data:image/png;base64,AAAA" });
    expect(uploadService.uploadImage).toHaveBeenCalledWith({ madrasaId: 42, slug: "demo" }, { image: "data:image/png;base64,AAAA", folder: "students" });
    expect(studentService.admitStudent).toHaveBeenCalledWith({ image: "https://cdn.example.com/photo.webp" }, 42, undefined, "WEBSITE");
  });
  it("assigns website origin from the public endpoint even if a visitor claims admin origin", async () => {
    const repository = { findPublicMadrasaBySlug: vi.fn(async () => ({ id: 42, isActive: 1, websiteStatus: "active" })) };
    const body = { name_bn: "Applicant", admission_source: "ADMIN" };
    await new WebsiteService(repository as any).submitFullAdmissionApplication("demo", body);
    expect(studentService.admitStudent).toHaveBeenCalledWith(body, 42, undefined, "WEBSITE");
  });
});
