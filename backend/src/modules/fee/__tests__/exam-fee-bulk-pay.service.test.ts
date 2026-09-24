import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("../../../shared/database/prisma", () => ({ prisma: {} }));
vi.mock("../../students/student.repository", () => ({
  studentRepository: { findByIdForTenant: vi.fn() },
}));
vi.mock("../../notifications/notification.service", () => ({
  notificationService: { triggerEvent: vi.fn(async () => undefined) },
}));
vi.mock("../../accounts/account.service", () => ({
  accountService: {
    getOptions: vi.fn(async () => ({ incomeFunds: [{ name: "সাধারণ ফান্ড", categories: ["ছাত্র ফি"] }] })),
  },
}));
vi.mock("../../../shared/utils/activity.util", () => ({ logActivity: vi.fn(async () => undefined) }));
vi.mock("../../exam-candidate/exam-candidate.hooks", () => ({
  autoRegisterOnInvoicePaid: vi.fn(async () => undefined),
}));

import { FeeService } from "../fee.service";
import { studentRepository } from "../../students/student.repository";
import { notificationService } from "../../notifications/notification.service";
import { logActivity } from "../../../shared/utils/activity.util";
import { autoRegisterOnInvoicePaid } from "../../exam-candidate/exam-candidate.hooks";

const M = 1;
const EXAM = 7;
const CLASS = 101;
const D = (n: number) => new Prisma.Decimal(n);

type Inv = {
  id: number;
  studentId: number;
  amount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  waivedAmount: Prisma.Decimal;
  status: string;
  feeStructureId: number;
  title: string;
  feeStructure: { examId: number | null; classId: number | null };
  student: { nameBn: string };
};

const inv = (id: number, over: Partial<Inv> = {}): Inv => ({
  id,
  studentId: id + 1000,
  amount: D(300),
  paidAmount: D(0),
  waivedAmount: D(0),
  status: "UNPAID",
  feeStructureId: 50,
  title: "পরীক্ষার ফি",
  feeStructure: { examId: EXAM, classId: CLASS },
  student: { nameBn: `ছাত্র ${id}` },
  ...over,
});

function build(invoices: Inv[]) {
  const store = new Map(invoices.map((i) => [i.id, { ...i }]));
  let nextPayment = 900;
  const tx = { account: { create: vi.fn(async () => ({ id: 77 })) } };
  const repository = {
    findExamForTenant: vi.fn(async (_m: number, id: number) =>
      id === EXAM ? { id: EXAM, name: "বার্ষিক পরীক্ষা", year: "2026" } : null,
    ),
    findClassName: vi.fn(async (id: number) => ({ id, nameBn: "মিজান" })),
    findInvoicesWithExamLink: vi.fn(async (_m: number, ids: number[]) =>
      ids.map((id) => store.get(id)).filter(Boolean),
    ),
    findExamFeeInvoicesForClass: vi.fn(),
    findPaymentMethodSettingForTenant: vi.fn(),
    runTransaction: vi.fn(async (fn: any) => fn(tx)),
    findInvoiceForTenantOnTx: vi.fn(async (_tx: unknown, id: number) => store.get(id) ?? null),
    updateInvoiceOnTx: vi.fn(async (_tx: unknown, id: number, data: any) => {
      Object.assign(store.get(id)!, { paidAmount: D(data.paidAmount), status: data.status });
    }),
    createPaymentOnTx: vi.fn(async () => ({ id: nextPayment++ })),
    findFeeStructureExamLink: vi.fn(async () => ({ examId: EXAM })),
  };
  const service = new FeeService(repository as any);
  return { service, repository, store };
}

beforeEach(() => {
  vi.clearAllMocks();
  (vi.mocked(studentRepository.findByIdForTenant) as any).mockImplementation(async (id: number) => ({
    id,
    nameBn: `ছাত্র ${id}`,
    guardianPhone: "01700000000",
    sessionId: 1,
    classId: CLASS,
    divisionId: 3,
    classRef: { nameBn: "মিজান" },
  }) as any);
});

describe("FeeService.recordPayment - notifyGuardian option", () => {
  it("sends the guardian SMS by default", async () => {
    const { service } = build([inv(1)]);
    await service.recordPayment(1, M, 5, { amount: 300, method: "CASH" });
    expect(notificationService.triggerEvent).toHaveBeenCalledTimes(1);
  });

  it("skips only the SMS when notifyGuardian is false - log + auto-registration still run", async () => {
    const { service } = build([inv(1)]);
    const result = await service.recordPayment(1, M, 5, { amount: 300, method: "CASH" }, { notifyGuardian: false });
    expect(result.invoiceStatus).toBe("PAID");
    expect(notificationService.triggerEvent).not.toHaveBeenCalled();
    expect(logActivity).toHaveBeenCalledTimes(1);
    expect(autoRegisterOnInvoicePaid).toHaveBeenCalledTimes(1);
  });
});

describe("FeeService.bulkPayExamFee", () => {
  const body = (invoice_ids: number[], extra: Record<string, unknown> = {}) => ({
    exam_id: EXAM,
    class_id: CLASS,
    invoice_ids,
    method: "CASH",
    ...extra,
  });

  it("keeps going after one invoice fails and reports it", async () => {
    const { service, repository } = build([inv(1), inv(2, { paidAmount: D(100), status: "PARTIALLY_PAID" }), inv(3)]);
    repository.createPaymentOnTx.mockImplementationOnce(async () => ({ id: 900 }));
    repository.createPaymentOnTx.mockImplementationOnce(async () => {
      throw new Error("db down");
    });

    const out = await service.bulkPayExamFee(M, 5, body([1, 2, 3, 2]));

    expect(out.succeeded.map((s) => s.invoice_id)).toEqual([1, 3]);
    expect(out.failed).toEqual([
      { invoice_id: 2, student_id: 1002, name_bn: "ছাত্র 2", reason: "পেমেন্ট রেকর্ড করা যায়নি" },
    ]);
    expect(out.total_collected).toBe(600);
    expect(repository.runTransaction).toHaveBeenCalledTimes(3); // deduped: 2 only once
    // Guardian SMS is off unless asked for.
    expect(notificationService.triggerEvent).not.toHaveBeenCalled();
    // Two per-invoice logs + one summary row.
    expect(vi.mocked(logActivity).mock.calls.at(-1)?.[0]).toMatchObject({
      entity: "invoices/exam-fee/bulk-pay",
      details: "পরীক্ষার ফি একসাথে গ্রহণ: বার্ষিক পরীক্ষা — মিজান, 2 জন, মোট 600 টাকা",
    });
  });

  it("pays the full remaining due of a partially paid invoice", async () => {
    const { service } = build([inv(2, { paidAmount: D(100), status: "PARTIALLY_PAID" })]);
    const out = await service.bulkPayExamFee(M, 5, body([2], { notify_guardian: true }));
    expect(out.succeeded).toEqual([{ invoice_id: 2, student_id: 1002, amount: 200, payment_id: 900 }]);
    expect(notificationService.triggerEvent).toHaveBeenCalledTimes(1);
  });

  it("rejects an invoice of another exam / class / unknown id without paying it", async () => {
    const { service, repository } = build([
      inv(1, { feeStructure: { examId: 99, classId: CLASS } }),
      inv(2, { feeStructure: { examId: EXAM, classId: 555 } }),
    ]);
    const out = await service.bulkPayExamFee(M, 5, body([1, 2, 3]));
    expect(out.succeeded).toEqual([]);
    expect(out.failed.map((f) => f.invoice_id)).toEqual([1, 2, 3]);
    expect(out.failed[0].reason).toMatch(/পরীক্ষার ফি নয়/);
    expect(out.failed[2]).toMatchObject({ student_id: null, name_bn: null });
    expect(repository.runTransaction).not.toHaveBeenCalled();
    expect(logActivity).not.toHaveBeenCalled();
  });

  it("skips already paid / waived invoices", async () => {
    const { service, repository } = build([
      inv(1, { paidAmount: D(300), status: "PAID" }),
      inv(2, { waivedAmount: D(300), status: "WAIVED" }),
      inv(3),
    ]);
    const out = await service.bulkPayExamFee(M, 5, body([1, 2, 3]));
    expect(out.failed.map((f) => [f.invoice_id, f.reason])).toEqual([
      [1, "ইতিমধ্যে পরিশোধিত"],
      [2, "ইতিমধ্যে পরিশোধিত"],
    ]);
    expect(out.succeeded.map((s) => s.invoice_id)).toEqual([3]);
    expect(repository.runTransaction).toHaveBeenCalledTimes(1);
  });

  it("400s on an empty selection or a bad method, 404s on an unknown exam", async () => {
    const { service } = build([inv(1)]);
    await expect(service.bulkPayExamFee(M, 5, body([]))).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.bulkPayExamFee(M, 5, body([1], { method: "GOLD" }))).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(service.bulkPayExamFee(M, 5, body([1], { exam_id: 8 }))).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("FeeService.getExamFeeCollectSheet", () => {
  it("lists only invoices with something due, roll order, and counts cleared students", async () => {
    const { service, repository } = build([]);
    const row = (id: number, roll: number | null, amount: number, paid: number, waived: number, status: string) => ({
      id,
      amount: D(amount),
      paidAmount: D(paid),
      waivedAmount: D(waived),
      status,
      student: { id: id + 1000, nameBn: `ছাত্র ${id}`, roll },
    });
    repository.findExamFeeInvoicesForClass.mockResolvedValue([
      row(1, 5, 300, 0, 0, "UNPAID"),
      row(2, 2, 300, 100, 0, "PARTIALLY_PAID"),
      row(3, 1, 300, 300, 0, "PAID"),
      row(4, 3, 300, 0, 300, "WAIVED"),
      row(5, null, 300, 0, 0, "OVERDUE"),
    ]);

    const sheet = await service.getExamFeeCollectSheet(M, EXAM, CLASS);
    expect(sheet.exam).toEqual({ id: EXAM, name: "বার্ষিক পরীক্ষা", year: "2026" });
    expect(sheet.class).toEqual({ id: CLASS, name_bn: "মিজান" });
    expect(sheet.rows.map((r) => r.invoice_id)).toEqual([2, 1, 5]);
    expect(sheet.rows[0]).toEqual({
      invoice_id: 2,
      student_id: 1002,
      name_bn: "ছাত্র 2",
      roll: 2,
      amount: 300,
      paid: 100,
      waived: 0,
      due: 200,
      status: "PARTIALLY_PAID",
    });
    expect(sheet.paid_count).toBe(2);
    expect(sheet.totals).toEqual({ due: 800 });
  });

  it("400s without exam/class and 404s for another tenant's exam", async () => {
    const { service } = build([]);
    await expect(service.getExamFeeCollectSheet(M, 0, CLASS)).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.getExamFeeCollectSheet(M, 8, CLASS)).rejects.toMatchObject({ statusCode: 404 });
  });
});
