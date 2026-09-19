import { describe, expect, it } from "vitest";
import { isExamDepartmentPermission, roleImpliesPermission } from "../rbac-policy";

describe("roleImpliesPermission", () => {
  const examDepartmentKeys = [
    "exam.read",
    "exam.manage",
    "exam.seat.manage",
    "marks.submit",
    "marks.verify",
    "result.read",
    "result.process",
    "result.approve",
    "result.publish",
    "result.correct",
    "routine.manage",
    "reports.exam",
    "reports.academic",
  ];

  it.each(examDepartmentKeys)("TALIMAT implicitly holds %s", (key) => {
    expect(roleImpliesPermission("TALIMAT", key)).toBe(true);
  });

  it("accepts the Bangla role label used on historical rows", () => {
    expect(roleImpliesPermission("তালিমাত", "result.publish")).toBe(true);
  });

  it.each(["accounts.read", "fee.manage", "payroll.manage", "students.read", "roles.manage", "users.create"])(
    "TALIMAT does NOT implicitly hold %s outside the exam department",
    (key) => {
      expect(roleImpliesPermission("TALIMAT", key)).toBe(false);
    },
  );

  it("does not confuse look-alike namespaces with the exam department", () => {
    expect(isExamDepartmentPermission("examination.read")).toBe(false);
    expect(isExamDepartmentPermission("resultant.read")).toBe(false);
  });

  it.each(["MUHTAMIM", "SUPER_ADMIN", "মুহতামিম"])("%s implies every permission", (role) => {
    expect(roleImpliesPermission(role, "accounts.read")).toBe(true);
    expect(roleImpliesPermission(role, "result.publish")).toBe(true);
    expect(roleImpliesPermission(role, "")).toBe(true);
  });

  it.each(["ACCOUNTANT", "TEACHER", "", null, undefined])("%s gets nothing implicitly", (role) => {
    expect(roleImpliesPermission(role, "result.read")).toBe(false);
  });

  it("gives TALIMAT nothing for an empty permission probe", () => {
    expect(roleImpliesPermission("TALIMAT", "")).toBe(false);
  });
});
