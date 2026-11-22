import { describe, expect, it, vi } from "vitest";

vi.mock("../../../shared/database/prisma", () => ({ prisma: {} }));
vi.mock("../../guardian/guardian.service", () => ({ guardianService: { ensureGuardianForStudent: vi.fn() } }));
vi.mock("../../fee/fee.service", () => ({ feeService: {} }));
vi.mock("../../notifications/notification.service", () => ({ notificationService: {} }));
vi.mock("../../../shared/utils/activity.util", () => ({ logActivity: vi.fn() }));
import { StudentService } from "../student.service";

function setup() {
  const existing = { id: 7, madrasaId: 9, classId: 3, sessionId: 1, academicYear: "2026", roll: 4, registrationNo: 12 };
  const tx = { student: { findFirst: vi.fn(async (): Promise<any> => null) } };
  const repo = {
    runTransaction: vi.fn(async (fn: any) => fn(tx)),
    lockStudentRecordOnTx: vi.fn(),
    findByIdForTenantOnTx: vi.fn(async () => existing),
    lockRollScopeOnTx: vi.fn(),
    updateManyForTenantOnTx: vi.fn(async () => ({ count: 1 })),
    findByIdForTenant: vi.fn(async () => null),
    lockRegistrationScopeOnTx: vi.fn(),
    allocateRegistrationNoOnTx: vi.fn(async () => 51),
    getNextAvailableRollOnTx: vi.fn(async () => 10),
  };
  return { service: new StudentService(repo as any), repo, tx, existing };
}

describe("admin roll adjustment", () => {
  it("allows an explicit free roll and preserves the registration number", async () => {
    const { service, repo, tx } = setup();
    await expect(service.updateStudent(7, 9, { roll: "2" })).resolves.toBe(1);
    expect(repo.lockRollScopeOnTx).toHaveBeenCalledWith(tx, 9, 3, "2026");
    expect(repo.updateManyForTenantOnTx).toHaveBeenCalledWith(tx, 7, 9, { roll: 2 });
    expect(tx.student.findFirst).toHaveBeenCalledWith({ where: { madrasaId: 9, classId: 3, academicYear: "2026", roll: 2, id: { not: 7 } }, select: { id: true } });
  });
  it("rejects a roll held by another student, including Trash", async () => {
    const { service, repo, tx } = setup();
    tx.student.findFirst.mockResolvedValue({ id: 8, deletedAt: new Date() });
    await expect(service.updateStudent(7, 9, { roll: 2 })).rejects.toThrow();
    expect(repo.updateManyForTenantOnTx).not.toHaveBeenCalled();
  });
  it.each([0, -1, "", null, 1.5, "abc", 2147483648])("rejects invalid roll %s", async (roll) => {
    const { service, repo } = setup();
    await expect(service.updateStudent(7, 9, { roll })).rejects.toThrow();
    expect(repo.updateManyForTenantOnTx).not.toHaveBeenCalled();
  });
  it("keeps pending admissions without a roll until approval", async () => {
    const { service, existing } = setup();
    existing.roll = null as any;
    await expect(service.updateStudent(7, 9, { roll: 2 })).rejects.toThrow();
  });
  it("rejects a manual registration change", async () => {
    const { service, repo } = setup();
    await expect(service.updateStudent(7, 9, { registration_no: 99 })).rejects.toThrow();
    expect(repo.updateManyForTenantOnTx).not.toHaveBeenCalled();
  });
  it("changes the registration number automatically when the class changes", async () => {
    const { service, repo, tx } = setup();
    await service.updateStudent(7, 9, { class_id: 5 });
    expect(repo.allocateRegistrationNoOnTx).toHaveBeenCalledWith(tx, 9, 5);
    expect(repo.updateManyForTenantOnTx).toHaveBeenCalledWith(tx, 7, 9, { classId: 5, roll: 10, registrationNo: 51 });
  });
});
