import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../../../shared/subscription/subscription-state", () => ({ getSubscriptionState: vi.fn(async () => "ACTIVE") }));
vi.mock("../../classPanal/class-panel.service", () => ({ classPanelService: { listDivisions: vi.fn() } }));
import { GuardianService } from "../guardian.service";
import { guardianRepository } from "../guardian.repository";
import { prisma } from "../../../shared/database/prisma";
afterEach(() => vi.restoreAllMocks());

describe("guardian personal profile", () => {
  it("returns personal details without waiting for attendance, fees or library services", async () => {
    const repo = {
      findOwnership: vi.fn().mockResolvedValue({ id: 1 }),
      findPersonalProfile: vi.fn().mockResolvedValue({
        id: 10, nameBn: "Student", fatherName: "Father", academicYear: "2026",
        classRef: { name: "Class", madrasaClasses: [{ nameBn: "Tenant class" }] },
        divisionRef: { name: "Division", madrasaDivisions: [{ nameBn: "Tenant division" }] },
        previousClass: null, sessionRef: { name: "2026–27" },
      }),
    };
    const data = await new GuardianService(repo as any).getChildPersonalProfile(7, 2, 10);
    expect(repo.findOwnership).toHaveBeenCalledWith(7, 10);
    expect(repo.findPersonalProfile).toHaveBeenCalledWith(2, 10);
    expect(data).toMatchObject({ fatherName: "Father", className: "Tenant class", divisionName: "Tenant division", sessionName: "2026–27" });
    expect(data).not.toHaveProperty("classRef");
  });
  it("rejects another guardian's student before reading personal information", async () => {
    const repo = { findOwnership: vi.fn().mockResolvedValue(null), findPersonalProfile: vi.fn() };
    await expect(new GuardianService(repo as any).getChildPersonalProfile(7, 2, 99)).rejects.toMatchObject({ statusCode: 403 });
    expect(repo.findPersonalProfile).not.toHaveBeenCalled();
  });
  it("handles a student deleted between authorization and profile lookup", async () => {
    const repo = { findOwnership: vi.fn().mockResolvedValue({ id: 1 }), findPersonalProfile: vi.fn().mockResolvedValue(null) };
    await expect(new GuardianService(repo as any).getChildPersonalProfile(7, 2, 10)).rejects.toMatchObject({ statusCode: 404 });
  });
  it("limits the query to the tenant and excludes internal device and review metadata", async () => {
    const lookup = vi.spyOn(prisma.student, "findFirst").mockResolvedValue(null);
    await guardianRepository.findPersonalProfile(2, 10);
    const query = lookup.mock.calls[0][0] as any;
    expect(query.where).toEqual({ id: 10, madrasaId: 2, deletedAt: null });
    expect(query.select).toMatchObject({ nameBn: true, guardianPhone: true, fatherName: true, motherName: true, village: true });
    for (const key of ["fingerprintId", "reviewedBy", "rejectionReason", "madrasa", "guardianLinks"]) expect(query.select).not.toHaveProperty(key);
  });
});
