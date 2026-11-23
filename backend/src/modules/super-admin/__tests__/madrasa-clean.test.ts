import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../shared/database/prisma", () => ({ prisma: {} }));
vi.mock("../../../shared/utils/hash.util", () => ({ comparePassword: vi.fn(async () => true) }));
vi.mock("../superadmin.service", () => ({ superAdminService: {} }));
vi.mock("../../students/registration-block.provisioner", () => ({
  assignMissingRegistrationBlocksOnTx: vi.fn(),
}));
vi.mock("../tenant-academic.service", () => ({ remapFeeTemplates: (rows: unknown[]) => rows }));

import { comparePassword } from "../../../shared/utils/hash.util";
import { EXAM_FEE_CATEGORY_NAME } from "../../fee/fee.constants";
import { assignMissingRegistrationBlocksOnTx } from "../../students/registration-block.provisioner";
import { MadrasaCleanRepository } from "../madrasa-clean.repository";
import { MadrasaCleanService } from "../madrasa-clean.service";
import {
  MADRASA_CLEAN_SECTIONS,
  type MadrasaCleanSection,
  resolveCleanSections,
} from "../madrasa-clean.dto";

// Record the complete mutation boundary without connecting to a real tenant.
function transaction() {
  const calls: { model: string; method: string; args: any }[] = [];
  const tx = new Proxy(
    {
      $executeRaw: vi.fn(async (sql: TemplateStringsArray, ...values: unknown[]) => {
        calls.push({
          model: "libraryBook",
          method: "resetInventory",
          args: { where: { madrasaId: values[0] } },
        });
        return 1;
      }),
    } as any,
    {
      get(target, model) {
        if (
          typeof model !== "string" ||
          ["constructor", "then", "toJSON", "asymmetricMatch"].includes(model)
        )
          return Reflect.get(target, model);
        return (target[model] ??= {
          deleteMany: vi.fn(async (args) => {
            calls.push({ model, method: "deleteMany", args });
            return { count: 1 };
          }),
          updateMany: vi.fn(async (args) => {
            calls.push({ model, method: "updateMany", args });
            return { count: 1 };
          }),
          findFirst: vi.fn(async () => ({ id: 4 })),
          findMany: vi.fn(async () => []),
          groupBy: vi.fn(async () => []),
        });
      },
    },
  );
  return { tx, calls };
}

describe("section-specific institution cleaning", () => {
  const repo = new MadrasaCleanRepository();

  it.each([
    ["fees", ["payment", "studentFeeDiscount", "invoice", "feeStructure"]],
    ["accounts", ["accountCategory", "accountFund", "account", "payment", "payrollRecord"]],
    [
      "attendance",
      [
        "attendanceChange",
        "leaveRequest",
        "sessionAttendance",
        "attendanceDeviceLog",
        "smsQueue",
        "attendance",
        "attendancePolicy",
      ],
    ],
    ["library", ["libraryBorrowRecord", "libraryBook"]],
    ["routines", ["classRoutine"]],
    ["logs", ["notificationLog", "activityLog", "smsQueue"]],
  ] as [MadrasaCleanSection, string[]][])(
    "%s touches only its own records",
    async (section, models) => {
      const { tx, calls } = transaction();
      await repo.wipeOperationalDataOnTx(tx, 7, [section]);
      expect(calls.map((call) => call.model)).toEqual(models);
      for (const call of calls) {
        expect(call.args.where.madrasaId ?? call.args.where.fund?.madrasaId).toBe(7);
      }
      expect(tx.personnelNumberReservation.deleteMany).not.toHaveBeenCalled();
      expect(tx.madrasaClass.updateMany).not.toHaveBeenCalled();
    },
  );

  it("exam cleaning keeps students, regular fees, invoices, accounts and personnel", async () => {
    const { tx, calls } = transaction();
    await repo.wipeOperationalDataOnTx(tx, 7, ["exams"]);
    expect(tx.feeStructure.deleteMany).toHaveBeenCalledWith({
      where: { madrasaId: 7, examId: { not: null } },
    });
    for (const model of [
      "student",
      "invoice",
      "payment",
      "account",
      "teacher",
      "staff",
      "classRoutine",
      "personnelNumberReservation",
    ]) {
      expect(calls.some((call) => call.model === model)).toBe(false);
    }
    const index = (model: string) => calls.findIndex((call) => call.model === model);
    expect(index("mark")).toBeLessThan(index("exam"));
    expect(index("resultMaster")).toBeLessThan(index("exam"));
    expect(index("seatAllocation")).toBeLessThan(index("examRoom"));
  });

  it("fee cleaning removes fee-linked income while preserving other accounts, payroll, funds and categories", async () => {
    const { tx } = transaction();
    let ledger = [
      { id: 101, madrasaId: 7, source: "fee" },
      { id: 201, madrasaId: 7, source: "payroll" },
      { id: 301, madrasaId: 7, source: "manual-income" },
      { id: 302, madrasaId: 7, source: "manual-expense" },
      { id: 401, madrasaId: 8, source: "fee" },
    ];
    tx.payment.findMany.mockResolvedValue([{ accountEntryId: 101 }, { accountEntryId: null }]);
    tx.account.deleteMany.mockImplementation(async ({ where }: any) => {
      ledger = ledger.filter(
        (entry) =>
          !(entry.madrasaId === where.madrasaId && (!where.id || where.id.in.includes(entry.id))),
      );
    });
    await repo.wipeOperationalDataOnTx(tx, 7, ["fees"]);
    expect(ledger.map((entry) => entry.id)).toEqual([201, 301, 302, 401]);
    expect(tx.account.deleteMany).toHaveBeenCalledWith({
      where: { madrasaId: 7, id: { in: [101] } },
    });
    for (const model of ["payment", "studentFeeDiscount", "invoice", "feeStructure"]) {
      expect(tx[model].deleteMany).toHaveBeenCalledWith({ where: { madrasaId: 7 } });
    }
    for (const model of ["accountFund", "accountCategory", "payrollRecord", "student", "exam"]) {
      expect(tx[model].deleteMany).not.toHaveBeenCalled();
      expect(tx[model].updateMany).not.toHaveBeenCalled();
    }
  });

  it("account cleaning keeps fees, payment amounts and payroll status while removing stale ledger links", async () => {
    const { tx } = transaction();
    const payment = { amount: 500, accountEntryId: 101 };
    const payroll = { status: "PAID", netAmount: 400, accountEntryId: 201 };
    tx.payment.updateMany.mockImplementation(async ({ data }: any) => Object.assign(payment, data));
    tx.payrollRecord.updateMany.mockImplementation(async ({ data }: any) =>
      Object.assign(payroll, data),
    );
    await repo.wipeOperationalDataOnTx(tx, 7, ["accounts"]);
    expect(tx.account.deleteMany).toHaveBeenCalledWith({ where: { madrasaId: 7 } });
    expect(payment).toEqual({ amount: 500, accountEntryId: null });
    expect(payroll).toEqual({ status: "PAID", netAmount: 400, accountEntryId: null });
    for (const model of [
      "payment",
      "studentFeeDiscount",
      "invoice",
      "feeStructure",
      "payrollRecord",
      "student",
    ]) {
      expect(tx[model].deleteMany).not.toHaveBeenCalled();
    }
    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: { madrasaId: 7 },
      data: { accountEntryId: null },
    });
  });

  it("student cleaning resets registration/roll history after deleting students and keeps class ranges and staff numbers", async () => {
    const { tx, calls } = transaction();
    await repo.wipeOperationalDataOnTx(tx, 7, ["students"]);
    expect(tx.student.deleteMany).toHaveBeenCalledWith({ where: { madrasaId: 7 } });
    expect(tx.personnelNumberReservation.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.personnelNumberReservation.deleteMany).toHaveBeenCalledWith({
      where: { madrasaId: 7, kind: { in: ["student-registration", "student-roll"] } },
    });
    expect(tx.madrasaClass.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.madrasaClass.updateMany).toHaveBeenCalledWith({
      where: { madrasaId: 7 },
      data: { regNoLastIssued: null },
    });
    expect(calls.findIndex((call) => call.model === "student")).toBeLessThan(
      calls.findIndex((call) => call.model === "personnelNumberReservation"),
    );
    expect(tx.teacher.deleteMany).not.toHaveBeenCalled();
    expect(tx.staff.deleteMany).not.toHaveBeenCalled();
    expect(tx.user.deleteMany).not.toHaveBeenCalled();
    expect(tx.activityLog.deleteMany).not.toHaveBeenCalled();
    for (const model of [
      "invoice",
      "attendance",
      "libraryBorrowRecord",
      "websiteAdmissionApplication",
    ]) {
      expect(calls.some((call) => call.model === model)).toBe(true);
    }
    expect(tx.exam.deleteMany).not.toHaveBeenCalled();
    expect(tx.examRoutine.deleteMany).not.toHaveBeenCalled();
    expect(tx.examRoom.deleteMany).not.toHaveBeenCalled();
    expect(tx.feeStructure.deleteMany).not.toHaveBeenCalled();
    expect(tx.accountFund.deleteMany).not.toHaveBeenCalled();
    expect(tx.accountCategory.deleteMany).not.toHaveBeenCalled();
    expect(tx.payrollRecord.deleteMany).not.toHaveBeenCalled();
    expect(tx.payrollRecord.updateMany).not.toHaveBeenCalled();
    expect(tx.attendance.deleteMany).toHaveBeenCalledWith({
      where: { madrasaId: 7, attendeeType: "STUDENT" },
    });
    expect(tx.libraryBorrowRecord.deleteMany).toHaveBeenCalledWith({
      where: { madrasaId: 7, studentId: { not: null } },
    });
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it("personnel cleaning resets only staff/teacher numbers and clears dependent duties", async () => {
    const { tx } = transaction();
    await repo.wipeOperationalDataOnTx(tx, 7, ["personnel"]);
    expect(tx.personnelNumberReservation.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.personnelNumberReservation.deleteMany).toHaveBeenCalledWith({
      where: { madrasaId: 7, kind: { in: ["teacher-registration", "staff-registration"] } },
    });
    expect(tx.examInvigilatorAssignment.deleteMany).toHaveBeenCalled();
    expect(tx.classRoutine.deleteMany).toHaveBeenCalledWith({
      where: { madrasaId: 7, teacherId: { not: null } },
    });
    expect(tx.student.deleteMany).not.toHaveBeenCalled();
    expect(tx.exam.deleteMany).not.toHaveBeenCalled();
    expect(tx.madrasaClass.updateMany).not.toHaveBeenCalled();
    expect(tx.user.deleteMany).not.toHaveBeenCalled();
    expect(tx.attendance.deleteMany).toHaveBeenCalledWith({
      where: { madrasaId: 7, attendeeType: { in: ["TEACHER", "STAFF"] } },
    });
    expect(tx.libraryBorrowRecord.deleteMany).toHaveBeenCalledWith({
      where: { madrasaId: 7, teacherId: { not: null } },
    });
  });

  it("student cleaning removes only payment-linked income and preserves payroll, manual income/expenses and other tenants", async () => {
    const { tx } = transaction();
    let ledger = [
      { id: 101, madrasaId: 7, source: "student-payment" },
      { id: 102, madrasaId: 7, source: "student-payment" },
      { id: 201, madrasaId: 7, source: "payroll" },
      { id: 301, madrasaId: 7, source: "manual-income" },
      { id: 302, madrasaId: 7, source: "manual-expense" },
      { id: 401, madrasaId: 8, source: "student-payment" },
    ];
    tx.payment.findMany.mockResolvedValue([
      { accountEntryId: 101 },
      { accountEntryId: 102 },
      { accountEntryId: null },
    ]);
    tx.account.deleteMany.mockImplementation(async ({ where }: any) => {
      ledger = ledger.filter(
        (entry) =>
          !(entry.madrasaId === where.madrasaId && (!where.id || where.id.in.includes(entry.id))),
      );
    });
    await repo.wipeOperationalDataOnTx(tx, 7, ["students"]);
    expect(tx.payment.findMany).toHaveBeenCalledWith({
      where: { madrasaId: 7, invoice: { student: { madrasaId: 7 } } },
      select: { accountEntryId: true },
    });
    expect(ledger.map((entry) => entry.id)).toEqual([201, 301, 302, 401]);
    expect(tx.account.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.account.deleteMany).toHaveBeenCalledWith({
      where: { madrasaId: 7, id: { in: [101, 102] } },
    });
    expect(tx.invoice.deleteMany).toHaveBeenCalledWith({
      where: { madrasaId: 7, student: { madrasaId: 7 } },
    });
  });

  it("personnel cleaning removes only payroll-linked expenses and preserves student and manual accounts", async () => {
    const { tx } = transaction();
    tx.payrollRecord.findMany.mockResolvedValue([
      { accountEntryId: 201 },
      { accountEntryId: null },
    ]);
    await repo.wipeOperationalDataOnTx(tx, 7, ["personnel"]);
    expect(tx.account.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.account.deleteMany).toHaveBeenCalledWith({
      where: { madrasaId: 7, id: { in: [201] } },
    });
    expect(tx.payment.deleteMany).not.toHaveBeenCalled();
    expect(tx.invoice.deleteMany).not.toHaveBeenCalled();
    expect(tx.accountFund.deleteMany).not.toHaveBeenCalled();
  });

  it("returns only copies on student loans while keeping teacher loans and library inventory", async () => {
    const { tx } = transaction();
    tx.libraryBorrowRecord.groupBy.mockResolvedValue([{ bookId: 25, _count: { _all: 2 } }]);
    await repo.wipeOperationalDataOnTx(tx, 7, ["students"]);
    expect(tx.libraryBorrowRecord.groupBy).toHaveBeenCalledWith({
      by: ["bookId"],
      where: { madrasaId: 7, studentId: { not: null }, status: "BORROWED" },
      _count: { _all: true },
    });
    expect(tx.libraryBook.updateMany).toHaveBeenCalledWith({
      where: { madrasaId: 7, id: 25 },
      data: { copiesAvailable: { increment: 2 } },
    });
    expect(tx.libraryBook.deleteMany).not.toHaveBeenCalled();
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it("full reset clears all sections, number history, attendance setup and logins together", async () => {
    const { tx } = transaction();
    await repo.wipeFullDataOnTx(tx, 7);
    for (const model of [
      "student",
      "teacher",
      "staff",
      "invoice",
      "exam",
      "payment",
      "feeStructure",
      "account",
      "accountFund",
      "attendance",
      "sessionAttendance",
      "leaveRequest",
      "activityLog",
      "user",
      "role",
      "attendancePolicy",
      "attendanceSession",
      "academicSequence",
    ]) {
      expect(tx[model].deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { madrasaId: 7 } }),
      );
    }
    expect(tx.personnelNumberReservation.deleteMany).toHaveBeenCalledWith({
      where: { madrasaId: 7 },
    });
    expect(tx.madrasa.deleteMany).not.toHaveBeenCalled();
    expect(tx.madrasaSubscription.deleteMany).not.toHaveBeenCalled();
  });

  it("normalizes explicit selections without adding other sections", () => {
    expect(resolveCleanSections(["students", "personnel", "students", "logs"])).toEqual([
      "students",
      "personnel",
      "logs",
    ]);
    expect(resolveCleanSections(["library"])).toEqual(["library"]);
  });
});

function serviceSetup() {
  const { tx } = transaction();
  tx.madrasaClass.findMany.mockResolvedValue([{ classId: 10, class: { sourceTemplateId: 10 } }]);
  const repository = {
    findMadrasaForClean: vi.fn(async () => ({
      id: 7,
      name: "Jamia",
      deletedAt: null,
      institutionType: "MADRASA",
    })),
    runTransaction: vi.fn(async (fn) => fn(tx)),
    wipeOperationalDataOnTx: vi.fn(),
    wipeFullDataOnTx: vi.fn(),
  };
  const superAdminRepo = {
    createActivityLogOnTx: vi.fn(async (_tx: any, _data: any) => undefined),
    findDefaultExamsOnTx: vi.fn(async () => [{ name: "Annual" }]),
    createDefaultExamsOnTx: vi.fn(),
    findDefaultFeeStructuresOnTx: vi.fn(async () => [
      { name: "Monthly", classId: 10, feeType: "Monthly" },
      { name: "Exam", classId: 10, feeType: EXAM_FEE_CATEGORY_NAME },
    ]),
    findExamsByNamesOnTx: vi.fn(async () => [{ id: 5, name: "Annual" }] as any[]),
    createDefaultFeeStructuresOnTx: vi.fn(async (_tx: any, _id: number, _rows: any[]) => undefined),
  };
  const accountRepo = { findById: vi.fn(async () => ({ passwordHash: "hash" })) };
  const provisioner = { provisionTenantOnTx: vi.fn() };
  return {
    tx,
    repository,
    superAdminRepo,
    accountRepo,
    provisioner,
    service: new MadrasaCleanService(
      repository as any,
      superAdminRepo as any,
      accountRepo as any,
      provisioner as any,
    ),
  };
}

const payload = { mode: "operational" as const, confirm_name: "Jamia", password: "secret" };

describe("clean request validation and default restoration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(comparePassword).mockResolvedValue(true);
  });

  it.each([undefined, [], ["unknown"], "students", ["students", "unknown"], ["finance"]])(
    "rejects invalid operational sections: %j",
    async (sections) => {
      const { service, repository } = serviceSetup();
      await expect(
        service.cleanMadrasaData(7, 99, { ...payload, sections } as any),
      ).rejects.toThrow();
      expect(repository.runTransaction).not.toHaveBeenCalled();
    },
  );

  it("does not wipe or reseed unselected parts and logs the selected scope", async () => {
    const { service, repository, tx, superAdminRepo, accountRepo } = serviceSetup();
    await service.cleanMadrasaData(7, 99, { ...payload, sections: ["library"] });
    expect(accountRepo.findById).toHaveBeenCalledWith(99);
    expect(repository.wipeOperationalDataOnTx).toHaveBeenCalledTimes(1);
    expect(repository.wipeOperationalDataOnTx).toHaveBeenCalledWith(tx, 7, ["library"]);
    expect(superAdminRepo.findDefaultExamsOnTx).not.toHaveBeenCalled();
    expect(superAdminRepo.createActivityLogOnTx.mock.calls[0][0]).toBe(tx);
    expect(JSON.parse(superAdminRepo.createActivityLogOnTx.mock.calls[0][1].details)).toMatchObject(
      {
        mode: "operational",
        sections: ["library"],
        superAdminId: 99,
      },
    );
  });

  it("fees-only cleaning restores fees without creating or replacing exams", async () => {
    const { service, superAdminRepo } = serviceSetup();
    await service.cleanMadrasaData(7, 99, { ...payload, sections: ["fees"] });
    expect(superAdminRepo.createDefaultExamsOnTx).not.toHaveBeenCalled();
    expect(superAdminRepo.createDefaultFeeStructuresOnTx.mock.calls[0][2]).toEqual([
      expect.objectContaining({ name: "Monthly" }),
      expect.objectContaining({ name: "Exam", examId: 5, isActive: false }),
    ]);
  });

  it("accounts-only cleaning does not recreate fees or exams", async () => {
    const { service, repository, superAdminRepo } = serviceSetup();
    await service.cleanMadrasaData(7, 99, { ...payload, sections: ["accounts"] });
    expect(repository.wipeOperationalDataOnTx).toHaveBeenCalledWith(expect.anything(), 7, [
      "accounts",
    ]);
    expect(superAdminRepo.findDefaultExamsOnTx).not.toHaveBeenCalled();
    expect(superAdminRepo.createDefaultFeeStructuresOnTx).not.toHaveBeenCalled();
  });

  it("exam-only cleaning restores exam fees without duplicating regular fees", async () => {
    const { service, superAdminRepo } = serviceSetup();
    await service.cleanMadrasaData(7, 99, { ...payload, sections: ["exams"] });
    expect(superAdminRepo.createDefaultExamsOnTx).toHaveBeenCalledTimes(1);
    expect(superAdminRepo.createDefaultFeeStructuresOnTx.mock.calls[0][2]).toEqual([
      expect.objectContaining({ name: "Exam", examId: 5, isActive: false }),
    ]);
  });

  it("full cleaning ignores partial selections, reprovisions and restores the main admin", async () => {
    const { service, repository, provisioner, tx, superAdminRepo } = serviceSetup();
    tx.user.findMany.mockResolvedValue([
      { name: "Admin", email: "admin@test", passwordHash: "hash", role: { keyName: "MUHTAMIM" } },
      {
        name: "Teacher",
        email: "teacher@test",
        passwordHash: "other",
        role: { keyName: "TEACHER" },
      },
    ]);
    await service.cleanMadrasaData(7, 99, { ...payload, mode: "full", sections: ["library"] });
    expect(repository.wipeFullDataOnTx).toHaveBeenCalledTimes(1);
    expect(repository.wipeFullDataOnTx).toHaveBeenCalledWith(tx, 7);
    expect(repository.wipeOperationalDataOnTx).not.toHaveBeenCalled();
    expect(provisioner.provisionTenantOnTx).toHaveBeenCalledWith(
      tx,
      7,
      expect.objectContaining({
        users: [{ role: "MUHTAMIM", name: "Admin", email: "admin@test", passwordHash: "hash" }],
      }),
    );
    expect(assignMissingRegistrationBlocksOnTx).toHaveBeenCalledWith(tx, 7);
    expect(
      JSON.parse(superAdminRepo.createActivityLogOnTx.mock.calls[0][1].details).sections,
    ).toEqual([...MADRASA_CLEAN_SECTIONS]);
  });

  it("rejects the wrong super admin password before any mutation", async () => {
    const { service, repository } = serviceSetup();
    vi.mocked(comparePassword).mockResolvedValue(false);
    await expect(
      service.cleanMadrasaData(7, 99, { ...payload, sections: ["fees"] }),
    ).rejects.toThrow();
    expect(repository.runTransaction).not.toHaveBeenCalled();
  });

  it("propagates reseeding failure from inside the same transaction without logging success", async () => {
    const { service, repository, superAdminRepo } = serviceSetup();
    superAdminRepo.findDefaultExamsOnTx.mockResolvedValue([]);
    await expect(
      service.cleanMadrasaData(7, 99, { ...payload, sections: ["fees"] }),
    ).rejects.toThrow();
    expect(repository.runTransaction).toHaveBeenCalledTimes(1);
    expect(repository.wipeOperationalDataOnTx).toHaveBeenCalledTimes(1);
    expect(superAdminRepo.createActivityLogOnTx).not.toHaveBeenCalled();
  });

  it("student-only cleaning does not expand into fees, accounts or exams or reseed their templates", async () => {
    const { service, repository, superAdminRepo } = serviceSetup();
    await service.cleanMadrasaData(7, 99, { ...payload, sections: ["students"] });
    expect(repository.wipeOperationalDataOnTx).toHaveBeenCalledWith(expect.anything(), 7, [
      "students",
    ]);
    expect(superAdminRepo.findDefaultExamsOnTx).not.toHaveBeenCalled();
    expect(superAdminRepo.createDefaultExamsOnTx).not.toHaveBeenCalled();
    expect(superAdminRepo.createDefaultFeeStructuresOnTx).not.toHaveBeenCalled();
    expect(
      JSON.parse(superAdminRepo.createActivityLogOnTx.mock.calls[0][1].details).sections,
    ).toEqual(["students"]);
  });
});
