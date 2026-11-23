import { beforeEach, describe, expect, it, vi } from "vitest";

const crypto = vi.hoisted(() => ({ hash: vi.fn(), compare: vi.fn() }));
vi.mock("bcryptjs", () => ({ default: crypto }));
import { syncSuperAdminFromEnv } from "../superadmin-env-sync";

const owner = { id: 1, name: "Original owner", email: "owner@example.test", passwordHash: "original-hash" };
const store = {
  findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(),
};
beforeEach(() => {
  vi.resetAllMocks();
  store.findFirst.mockResolvedValue({ ...owner });
  store.findUnique.mockResolvedValue(null);
  store.create.mockImplementation(async ({ data }) => ({ id: 1, ...data }));
  store.update.mockImplementation(async ({ data }) => ({ ...owner, ...data }));
  crypto.hash.mockResolvedValue("new-hash");
  crypto.compare.mockResolvedValue(true);
});

describe("super-admin startup credentials", () => {
  it("creates the initial account only when all credentials are supplied", async () => {
    store.findFirst.mockResolvedValue(null);
    const result = await syncSuperAdminFromEnv(store, { SUPER_ADMIN_NAME: "Owner", SUPER_ADMIN_EMAIL: " OWNER@EXAMPLE.TEST ", SUPER_ADMIN_PASSWORD: "test-password" });
    expect(result.status).toBe("created");
    expect(store.create).toHaveBeenCalledWith({ data: { name: "Owner", email: "owner@example.test", passwordHash: "new-hash", isActive: 1 } });
  });
  it("preserves existing fields when env values are absent or blank", async () => {
    const result = await syncSuperAdminFromEnv(store, { SUPER_ADMIN_NAME: " ", SUPER_ADMIN_EMAIL: "", SUPER_ADMIN_PASSWORD: " " });
    expect(result).toMatchObject({ account: owner, status: "unchanged" });
    expect(store.create).not.toHaveBeenCalled();
    expect(store.update).not.toHaveBeenCalled();
    expect(crypto.hash).not.toHaveBeenCalled();
  });
  it("does not rewrite the hash or account when env credentials are unchanged", async () => {
    const result = await syncSuperAdminFromEnv(store, { SUPER_ADMIN_NAME: owner.name, SUPER_ADMIN_EMAIL: owner.email, SUPER_ADMIN_PASSWORD: "test-password" });
    expect(crypto.compare).toHaveBeenCalledWith("test-password", "original-hash");
    expect(result.status).toBe("unchanged");
    expect(store.update).not.toHaveBeenCalled();
    expect(crypto.hash).not.toHaveBeenCalled();
  });
  it("updates changed name and email on the original ID without creating a duplicate", async () => {
    const result = await syncSuperAdminFromEnv(store, { SUPER_ADMIN_NAME: "New owner", SUPER_ADMIN_EMAIL: "new@example.test" });
    expect(result).toMatchObject({ status: "updated", changedFields: ["name", "email"] });
    expect(store.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { name: "New owner", email: "new@example.test" } });
    expect(store.create).not.toHaveBeenCalled();
  });
  it("changes the password only when a different nonempty password is supplied", async () => {
    crypto.compare.mockResolvedValue(false);
    const result = await syncSuperAdminFromEnv(store, { SUPER_ADMIN_PASSWORD: "new-test-password" });
    expect(result).toMatchObject({ status: "updated", changedFields: ["password"] });
    expect(store.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { passwordHash: "new-hash" } });
    expect(JSON.stringify(result)).not.toContain("new-test-password");
  });
  it("rejects an email owned by another account without modifying either account", async () => {
    store.findUnique.mockResolvedValue({ ...owner, id: 2, email: "other@example.test" });
    await expect(syncSuperAdminFromEnv(store, { SUPER_ADMIN_EMAIL: "other@example.test" })).rejects.toThrow("another Super Admin");
    expect(store.update).not.toHaveBeenCalled();
    expect(store.create).not.toHaveBeenCalled();
  });
  it("fails clearly when there is no old account and required env values are missing", async () => {
    store.findFirst.mockResolvedValue(null);
    await expect(syncSuperAdminFromEnv(store, {})).rejects.toThrow("No existing Super Admin");
    expect(store.create).not.toHaveBeenCalled();
  });
  it("rejects short new passwords before changing the existing account", async () => {
    await expect(syncSuperAdminFromEnv(store, { SUPER_ADMIN_PASSWORD: "short" })).rejects.toThrow("at least 8 characters");
    expect(store.update).not.toHaveBeenCalled();
  });
});
