import { describe, expect, it, vi } from "vitest";

vi.mock("../../../shared/database/prisma", () => ({ prisma: {} }));
vi.mock("../../guardian/guardian.service", () => ({ guardianService: {} }));
vi.mock("../../fee/fee.service", () => ({ feeService: {} }));
vi.mock("../../notifications/notification.service", () => ({ notificationService: {} }));
vi.mock("../../../shared/utils/activity.util", () => ({ logActivity: vi.fn() }));

import { StudentService } from "../student.service";
import { StudentNotFoundError, TenantNotResolvedError } from "../student.types";
import { BadRequestError } from "../../../shared/errors";

const setup = () => {
  const existing = { id: 11, nameBn: "Returning student", nid: null, classId: 2, academicYear: "2025", registrationNo: 55 };
  const tx = {};
  const repo = {
    findSessionByNameForTenant: vi.fn(async () => ({ id: 3, name: "2026" })),
    runTransaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(tx)),
    lockStudentIdentityOnTx: vi.fn(),
    lockStudentRecordOnTx: vi.fn(),
    findByNidOnTx: vi.fn(async (): Promise<any> => null),
    findByIdForTenantOnTx: vi.fn(async (): Promise<any> => existing),
    updateManyForTenantOnTx: vi.fn(async () => ({ count: 1 })),
    createOnTx: vi.fn(async () => ({ id: 99, registrationNo: null })),
    findByIdForTenant: vi.fn(async () => existing),
    searchForAdmission: vi.fn(async () => [existing]),
  };
  const body = { name_bn: "Returning student", division_id: 1, class_id: 4, academic_year: "2026", admission_mode: "existing", existing_student_id: 11 };
  return { repo, tx, body, service: new StudentService(repo as any) };
};

describe("admission student selection", () => {
  it("re-admits a selected student without NID using the same record and approval workflow", async () => {
    const { service, repo, tx, body } = setup();
    const result = await service.admitStudent(body, 9, 7);
    expect(result).toMatchObject({ studentId: 11, action: "re_admitted", admissionStatus: "PENDING", invoices: [] });
    expect(repo.findByIdForTenantOnTx).toHaveBeenCalledWith(tx, 11, 9);
    expect(repo.updateManyForTenantOnTx).toHaveBeenCalledWith(tx, 11, 9, expect.objectContaining({ admissionType: "RE_ADMISSION", sessionId: 3, classId: 4, roll: null, registrationNo: null }));
    expect(repo.createOnTx).not.toHaveBeenCalled();
  });

  it("rejects another tenant's or deleted student instead of creating a new student", async () => {
    const { service, repo, body } = setup();
    repo.findByIdForTenantOnTx.mockResolvedValue(null);
    await expect(service.admitStudent(body, 9, 7)).rejects.toBeInstanceOf(StudentNotFoundError);
    expect(repo.createOnTx).not.toHaveBeenCalled();
    expect(repo.updateManyForTenantOnTx).not.toHaveBeenCalled();
  });

  it("rejects a NID belonging to a different student", async () => {
    const { service, repo, body } = setup();
    repo.findByNidOnTx.mockResolvedValue({ id: 22 });
    await expect(service.admitStudent({ ...body, nid: "1234" }, 9, 7)).rejects.toBeInstanceOf(BadRequestError);
    expect(repo.updateManyForTenantOnTx).not.toHaveBeenCalled();
  });

  it("requires selection in existing mode and an authenticated staff member for ID selection", async () => {
    const { service, repo, body } = setup();
    await expect(service.admitStudent({ ...body, existing_student_id: undefined }, 9, 7)).rejects.toBeInstanceOf(BadRequestError);
    await expect(service.admitStudent(body, 9)).rejects.toBeInstanceOf(BadRequestError);
    await expect(service.admitStudent({ ...body, existing_student_id: -1 }, 9, 7)).rejects.toBeInstanceOf(BadRequestError);
    expect(repo.runTransaction).not.toHaveBeenCalled();
  });

  it("does not silently overwrite an existing student in new mode", async () => {
    const { service, repo, body } = setup();
    repo.findByNidOnTx.mockResolvedValue({ id: 22 });
    await expect(service.admitStudent({ ...body, admission_mode: "new", existing_student_id: undefined, nid: "1234" }, 9, 7)).rejects.toBeInstanceOf(BadRequestError);
    expect(repo.updateManyForTenantOnTx).not.toHaveBeenCalled();
  });

  it("creates a new pending record for a new student", async () => {
    const { service, repo, body } = setup();
    const result = await service.admitStudent({ ...body, admission_mode: "new", existing_student_id: undefined }, 9, 7);
    expect(result).toMatchObject({ studentId: 99, action: "created", admissionStatus: "PENDING" });
    expect(repo.createOnTx).toHaveBeenCalled();
    expect(repo.updateManyForTenantOnTx).not.toHaveBeenCalled();
  });

  it("searches within the tenant, normalizes Bengali numbers, and allows single-digit registration", async () => {
    const { service, repo } = setup();
    await expect(service.searchForAdmission(" ৫ ", 9)).resolves.toEqual([expect.objectContaining({ id: 11, name_bn: "Returning student" })]);
    expect(repo.searchForAdmission).toHaveBeenCalledWith(9, "5");
    await expect(service.searchForAdmission("A", 9)).resolves.toEqual([]);
    await expect(service.searchForAdmission("Ab", undefined)).rejects.toBeInstanceOf(TenantNotResolvedError);
  });
});
