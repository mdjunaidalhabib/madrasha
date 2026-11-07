import { describe, expect, it, vi } from "vitest";

vi.mock("../../database/prisma", () => ({ prisma: {} }));
vi.mock("../../utils/activity.util", () => ({ logActivity: vi.fn() }));
vi.mock("../../utils/hash.util", () => ({ hashPassword: vi.fn(async () => "hashed") }));
vi.mock("../../storage", () => ({ storageProvider: {} }));
vi.mock("../../../modules/guardian/guardian.service", () => ({ guardianService: {} }));
vi.mock("../../../modules/fee/fee.service", () => ({ feeService: {} }));
vi.mock("../../../modules/notifications/notification.service", () => ({ notificationService: {} }));

import { SettingsService } from "../../../modules/settings/settings.service";
import { StudentService } from "../../../modules/students/student.service";
import { UserService } from "../../../modules/users/user.service";
import { PLAN_SEEDS } from "../../../../prisma/data/plans.seed";
import { recommendOverLimitAction } from "../subscription-pricing";

describe("subscription limits are advisory", () => {
  it("keeps the existing plan fields and uses only the caller's active-student count", async () => {
    const plus = PLAN_SEEDS.find((p) => p.name === "Plus")!;
    const endDate = new Date();
    endDate.setHours(0, 0, 0, 0);
    endDate.setDate(endDate.getDate() + 364);
    const startDate = new Date();
    const repo = {
      findMadrasaLimits: vi.fn(async () => ({
        studentLimit: 300,
        userLimit: 1,
        planStatus: "active",
      })),
      findActiveSubscription: vi.fn(async () => ({
        plan: plus,
        startDate,
        endDate,
        cycle: "FIRST",
      })),
      countActiveStudents: vi.fn(async (id) => (id === 7 ? 450 : 10)),
      countActiveUsers: vi.fn(async () => 50),
      findAvailablePricingPlans: vi.fn(async () => PLAN_SEEDS),
    };
    const service = new SettingsService(repo as any);
    const first = await service.getMyPlan(7);
    expect(first).toMatchObject({
      plan_name: "Plus",
      price: 10000,
      duration_days: 365,
      start_date: startDate,
      end_date: endDate,
      days_remaining: 364,
      plan_status: "active",
      has_active_subscription: true,
      student_limit: 300,
      user_limit: 1,
      usage: { students: 450, users: 50 },
      over_limit: recommendOverLimitAction({
        plan: plus,
        plans: PLAN_SEEDS,
        studentCount: 450,
        cycle: "FIRST",
        remainingDays: 365,
        durationDays: 365,
      }),
    });
    expect((await service.getMyPlan(8)).over_limit).toMatchObject({
      studentCount: 10,
      overLimit: false,
      blocked: false,
    });
    for (const fn of [
      repo.findMadrasaLimits,
      repo.findActiveSubscription,
      repo.countActiveStudents,
      repo.countActiveUsers,
    ]) {
      expect(fn).toHaveBeenNthCalledWith(1, 7);
      expect(fn).toHaveBeenNthCalledWith(2, 8);
    }
  });

  it("creates users even when the legacy user limit is exceeded", async () => {
    const repo = {
      findRoleForTenant: vi.fn(async () => ({ keyName: "TEACHER" })),
      findMadrasaUserLimit: vi.fn(async () => ({ userLimit: 1 })),
      countActiveForTenant: vi.fn(async () => 500),
      create: vi.fn(async () => ({ id: 99 })),
    };
    const service = new UserService(repo as any);
    await expect(
      service.createUser(7, 1, {
        name: "Teacher",
        email: "t@example.test",
        password: "secret123",
        role_id: 2,
      }),
    ).resolves.toBe(99);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ madrasaId: 7 }));
    expect(repo.findMadrasaUserLimit).not.toHaveBeenCalled();
    expect(repo.countActiveForTenant).not.toHaveBeenCalled();
  });

  it("continues admitting students when an institution is over its plan limit", async () => {
    const repo = {
      findSessionByNameForTenant: vi.fn(async () => ({ id: 1, name: "2026" })),
      runTransaction: vi.fn(async (fn) => fn({})),
      createOnTx: vi.fn(async () => ({ id: 301, registrationNo: null })),
      findByIdForTenant: vi.fn(async () => null),
      findMadrasaLimits: vi.fn(async () => ({ studentLimit: 50 })),
      countActiveStudents: vi.fn(async () => 300),
    };
    const service = new StudentService(repo as any);
    await expect(
      service.admitStudent(
        { name_bn: "নতুন শিক্ষার্থী", division_id: 1, class_id: 1, academic_year: "2026" },
        7,
      ),
    ).resolves.toMatchObject({ studentId: 301, action: "created", admissionStatus: "PENDING" });
    expect(repo.createOnTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ madrasaId: 7 }),
    );
  });
});
