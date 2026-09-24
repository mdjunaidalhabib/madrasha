import { describe, expect, it, vi } from "vitest";

vi.mock("../../../shared/database/prisma", () => ({ prisma: {} }));

import { ResultPanelService } from "../result-panel.service";

const student = (id: number, roll: number | null, classId: number, sortOrder: number) => ({
  id,
  nameBn: `ছাত্র ${id}`,
  roll,
  classId,
  classRef: { nameBn: `শ্রেণি ${classId}`, sortOrder },
});

const invoice = (s: ReturnType<typeof student>, amount: number, paid: number, status = "UNPAID", waived = 0) => ({
  amount,
  paidAmount: paid,
  waivedAmount: waived,
  status,
  student: s,
});

const makeService = (repo: Record<string, unknown>) => new ResultPanelService(repo as any);

describe("getDashboardExamFee", () => {
  it("splits students into paid / unpaid by what is still due, ordered by class then roll", async () => {
    const a = student(1, 2, 10, 1);
    const b = student(2, 1, 10, 1);
    const c = student(3, 1, 20, 0);
    const d = student(4, 5, 20, 0);
    const service = makeService({
      findLatestActiveExam: vi.fn().mockResolvedValue({ id: 7, name: "বার্ষিক", year: "2026" }),
      findExamFeeInvoices: vi.fn().mockResolvedValue([
        invoice(a, 300, 300, "PAID"),
        invoice(b, 300, 100, "PARTIALLY_PAID"),
        invoice(c, 200, 0),
        invoice(d, 200, 0, "WAIVED", 200),
      ]),
    });

    const result = await service.getDashboardExamFee(1);

    expect(result.exam?.id).toBe(7);
    expect(result.unpaid.map((r) => [r.student_id, r.due])).toEqual([
      [3, 200],
      [2, 200],
    ]);
    expect(result.paid.map((r) => r.student_id)).toEqual([4, 1]);
    expect(result.totals).toEqual({ collected: 400, due: 400 });
    expect(result.paid[0]).not.toHaveProperty("class_order");
  });

  it("uses the requested exam and returns empty lists when there is none", async () => {
    const findExamForDashboard = vi.fn().mockResolvedValue(null);
    const service = makeService({ findExamForDashboard, findExamFeeInvoices: vi.fn() });

    const result = await service.getDashboardExamFee(1, 99);

    expect(findExamForDashboard).toHaveBeenCalledWith(1, 99);
    expect(result).toEqual({ exam: null, paid: [], unpaid: [], totals: { collected: 0, due: 0 } });
  });
});
