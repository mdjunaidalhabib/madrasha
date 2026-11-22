import { describe, expect, it, vi } from "vitest";

vi.mock("../../../shared/subscription/subscription-state", () => ({ getSubscriptionState: vi.fn(async () => "ACTIVE") }));
vi.mock("../../students/student.service", () => ({ studentService: { admitStudent: vi.fn(async () => ({ admissionStatus: "PENDING" })) } }));

import { studentService } from "../../students/student.service";
import { WebsiteService } from "../website.service";

describe("public admission source", () => {
  it("assigns website origin from the public endpoint even if a visitor claims admin origin", async () => {
    const repository = { findPublicMadrasaBySlug: vi.fn(async () => ({ id: 42, isActive: 1, websiteStatus: "active" })) };
    const body = { name_bn: "Applicant", admission_source: "ADMIN" };
    await new WebsiteService(repository as any).submitFullAdmissionApplication("demo", body);
    expect(studentService.admitStudent).toHaveBeenCalledWith(body, 42, undefined, "WEBSITE");
  });
});
