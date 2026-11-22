import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { resolveDashboardScope, sessionDateSql, studentSessionWhere } from "../dashboard.scope";

vi.mock("../../../shared/database/prisma", () => ({
  prisma: {
    student: { count: vi.fn(), groupBy: vi.fn() },
    account: { aggregate: vi.fn() },
    $queryRaw: vi.fn().mockResolvedValue([]),
  },
}));

import { prisma } from "../../../shared/database/prisma";
import { DashboardRepository } from "../dashboard.repository";
import { DashboardService } from "../dashboard.service";

const sessions = [
  {
    id: 11,
    name: "2026",
    divisionId: null,
    isActive: true,
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-12-31"),
  },
  {
    id: 12,
    name: "1448",
    divisionId: 2,
    isActive: true,
    startDate: new Date("2026-04-01"),
    endDate: new Date("2027-03-31"),
  },
  {
    id: 9,
    name: "2025",
    divisionId: null,
    isActive: false,
    startDate: new Date("2025-01-01"),
    endDate: new Date("2025-12-31"),
  },
];

describe("dashboard session scope", () => {
  it("defaults to active sessions across division calendars", () => {
    expect(resolveDashboardScope(sessions).selected.map((s) => s.id)).toEqual([11, 12]);
  });

  it("supports historical and all-session views", () => {
    expect(resolveDashboardScope(sessions, "9").selected).toEqual([sessions[2]]);
    expect(studentSessionWhere(resolveDashboardScope(sessions, "all"))).toEqual({});
  });

  it("does not fall back to all data when no session is active", () => {
    const scope = resolveDashboardScope([sessions[2]]);
    expect(studentSessionWhere(scope)).toEqual({ sessionId: { in: [] } });
    expect(sessionDateSql(scope, Prisma.sql`date`).text).toBe("FALSE");
  });

  it.each(["0", "-1", "1.5", "all OR 1=1", "9007199254740992", ""])(
    "rejects invalid selection %s",
    (selection) => {
      expect(() => resolveDashboardScope(sessions, selection)).toThrow("Invalid dashboard session");
    },
  );

  it("rejects another tenant's session instead of widening the scope", () => {
    expect(() => resolveDashboardScope(sessions, "999")).toThrow("Session not found");
  });

  it("combines overlapping date windows with OR and includes the entire end date", () => {
    const sql = sessionDateSql(resolveDashboardScope(sessions), Prisma.sql`entry_date`);
    expect(sql.text).toContain(" OR ");
    expect(sql.values).toEqual([
      sessions[0].startDate,
      new Date("2027-01-01"),
      sessions[1].startDate,
      new Date("2027-04-01"),
    ]);
  });
});

describe("dashboard queries", () => {
  const repo = new DashboardRepository();
  beforeEach(() => vi.clearAllMocks());

  it("filters student totals and gender counts by the same session IDs and tenant", () => {
    const scope = resolveDashboardScope(sessions, "9");
    repo.countActiveStudents(3, scope);
    repo.countActiveStudentsByGender(3, scope);
    const where = {
      madrasaId: 3,
      sessionId: { in: [9] },
      admissionStatus: "APPROVED",
      isActive: 1,
      deletedAt: null,
    };
    expect(prisma.student.count).toHaveBeenCalledWith({ where });
    expect(prisma.student.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where }));
  });

  it("filters dated and legacy ledger rows while preserving institution balances", () => {
    repo.sumAccountsByType(3, "income", resolveDashboardScope(sessions, "9"));
    expect(prisma.account.aggregate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          madrasaId: 3,
          OR: [
            { entryDate: { gte: sessions[2].startDate, lt: new Date("2026-01-01") } },
            {
              entryDate: null,
              createdAt: { gte: sessions[2].startDate, lt: new Date("2026-01-01") },
            },
          ],
        }),
      }),
    );
    repo.sumAccountsByType(3, "income");
    expect(prisma.account.aggregate).toHaveBeenLastCalledWith({
      where: { madrasaId: 3, type: "income", deletedAt: null },
      _sum: { amount: true },
    });
  });

  it("keeps old fee invoices in their original session after a student transfers", async () => {
    await repo.findOverdueSummary(3, resolveDashboardScope(sessions, "9"));
    const [strings, ...values] = vi.mocked(prisma.$queryRaw).mock.calls[0];
    const sql = Prisma.sql(strings as TemplateStringsArray, ...values);
    expect(sql.text).toContain("SELECT fs.session_id FROM fee_structures");
    expect(sql.text).toContain("COALESCE(");
    expect(sql.values).toContainEqual([9]);
  });

  it("uses the same scope for financial and attendance trends", async () => {
    const fake = {
      findDashboardSessions: vi.fn().mockResolvedValue(sessions),
      findIncomeExpenseTrend: vi.fn().mockResolvedValue([]),
      findAttendanceRateTrend: vi.fn().mockResolvedValue([]),
    };
    await new DashboardService(fake as unknown as DashboardRepository).getTrends(3, "monthly", "9");
    expect(fake.findDashboardSessions).toHaveBeenCalledWith(3);
    for (const query of [fake.findIncomeExpenseTrend, fake.findAttendanceRateTrend]) {
      expect(query.mock.calls[0][3].selected.map((s: { id: number }) => s.id)).toEqual([9]);
    }
  });
});
