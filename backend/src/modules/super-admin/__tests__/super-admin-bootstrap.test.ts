import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sync: vi.fn(), status: vi.fn(), store: {} }));
vi.mock("../../../shared/database/prisma", () => ({ prisma: { superAdmin: mocks.store } }));
vi.mock("../../../shared/logger/logger", () => ({ logger: { status: mocks.status } }));
vi.mock("../superadmin-env-sync", () => ({ syncSuperAdminFromEnv: mocks.sync }));
import { syncStartupSuperAdmin } from "../../../core/superadmin-bootstrap";

beforeEach(() => vi.resetAllMocks());

describe("server startup super-admin status", () => {
  it.each([
    ["created", "Super admin: account created.", ["name", "email", "password"]],
    ["updated", "Super admin: account updated.", ["password"]],
    ["unchanged", "Super admin: account unchanged.", []],
  ])("prints only the English %s status without user information", async (status, message, changedFields) => {
    mocks.sync.mockResolvedValue({ status, changedFields, account: { id: 1, name: "Owner", email: "owner@example.test", passwordHash: "hidden-password-hash" } });
    await syncStartupSuperAdmin();
    expect(mocks.sync).toHaveBeenCalledWith(mocks.store);
    expect(mocks.status.mock.calls).toEqual([[status, message]]);
    expect(JSON.stringify(mocks.status.mock.calls)).not.toMatch(/Owner|owner@example|hidden-password-hash|changedFields/);
  });
  it.each([
    ["No existing Super Admin. Set credentials", "missing configuration"],
    ["SUPER_ADMIN_PASSWORD must be at least 8 characters", "invalid password configuration"],
    ["SUPER_ADMIN_EMAIL belongs to another Super Admin", "email conflict"],
    ["Database refused: private-password and private-connection-url", "database or configuration error"],
  ])("prints a safe English failure status for %s", async (error, reason) => {
    mocks.sync.mockRejectedValue(new Error(error));
    await expect(syncStartupSuperAdmin()).resolves.toBeUndefined();
    expect(mocks.status.mock.calls).toEqual([["failed", `Super admin: sync failed (${reason}).`]]);
    expect(mocks.status.mock.calls[0][1]).toMatch(/^[\x20-\x7e]+$/);
    expect(JSON.stringify(mocks.status.mock.calls)).not.toContain("private");
  });
});
