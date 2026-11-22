import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../shared/subscription/subscription-state", () => ({ getSubscriptionState: vi.fn(async () => "ACTIVE") }));
vi.mock("../../classPanal/class-panel.service", () => ({ classPanelService: { listDivisions: vi.fn() } }));
import { GuardianService } from "../guardian.service";
import { comparePassword } from "../../../shared/utils/hash.util";
import { guardianCredentialVersion } from "../guardian-session";
import { guardianAuthMiddleware } from "../../../shared/middleware/guardianAuth.middleware";
import { guardianRepository } from "../guardian.repository";
import { generateToken, verifyToken } from "../../../shared/utils/jwt.util";
import { prisma } from "../../../shared/database/prisma";
import { guardianPasswordResetSchema } from "../../students/student.validation";

afterEach(() => vi.restoreAllMocks());

describe("guardian password reset", () => {
  it("requires both explicit confirmations before allowing a reset request", () => {
    for (const body of [{}, { card_verified: true }, { card_verified: false, reset_confirmed: true }, { card_verified: true, reset_confirmed: false }, { card_verified: "true", reset_confirmed: "true" }]) {
      expect(guardianPasswordResetSchema.safeParse({ params: { id: "10" }, body }).success).toBe(false);
    }
    expect(guardianPasswordResetSchema.safeParse({ params: { id: "10" }, body: { card_verified: true, reset_confirmed: true } }).success).toBe(true);
  });
  it("requires the current registered phone, student link and matching tenant", async () => {
    vi.spyOn(prisma.student, "findFirst").mockResolvedValue({ guardianPhone: "01712345678" } as any);
    const findGuardian = vi.spyOn(prisma.guardian, "findFirst").mockResolvedValue(null);
    await guardianRepository.findForStudent(2, 10);
    expect(prisma.student.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 10, madrasaId: 2, deletedAt: null } }));
    expect(findGuardian).toHaveBeenCalledWith({ where: { madrasaId: 2, phone: "01712345678", isActive: 1, students: { some: { studentId: 10 } } } });
  });
  it("resets lockout state and audits without storing the temporary password", async () => {
    const tx = { guardian: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) }, activityLog: { create: vi.fn() } };
    vi.spyOn(prisma, "$transaction").mockImplementation(async (fn: any) => fn(tx));
    await guardianRepository.resetPassword(7, 2, "hashed-secret", 3, 10);
    expect(tx.guardian.updateMany).toHaveBeenCalledWith({ where: { id: 7, madrasaId: 2, isActive: 1 }, data: { passwordHash: "hashed-secret", mustChangePassword: true, failedLoginAttempts: 0, lockedUntil: null } });
    expect(tx.activityLog.create).toHaveBeenCalledWith({ data: { madrasaId: 2, userId: 3, action: "UPDATE", entity: "students/guardian/reset-password", entityId: 10, details: '{"guardianId":7,"cardVerified":true,"resetConfirmed":true}' } });
    tx.guardian.updateMany.mockResolvedValueOnce({ count: 0 });
    tx.activityLog.create.mockClear();
    await expect(guardianRepository.resetPassword(7, 2, "hashed-secret", 3, 10)).rejects.toMatchObject({ statusCode: 404 });
    expect(tx.activityLog.create).not.toHaveBeenCalled();
  });
  it("restores the last four phone digits and hashes them afresh on every reset", async () => {
    const repo = { findForStudent: vi.fn().mockResolvedValue({ id: 7, phone: "01712345678" }), resetPassword: vi.fn() };
    const service = new GuardianService(repo as any);
    const first = await service.resetPasswordForStudent(2, 10, 3);
    const second = await service.resetPasswordForStudent(2, 10, 3);
    expect(repo.findForStudent).toHaveBeenCalledWith(2, 10);
    expect(first.temporaryPassword).toBe("5678");
    expect(second.temporaryPassword).toBe("5678");
    expect(repo.resetPassword.mock.calls[1][2]).not.toBe(repo.resetPassword.mock.calls[0][2]);
    const [id, tenant, hash, actor, student] = repo.resetPassword.mock.calls[0];
    expect([id, tenant, actor, student]).toEqual([7, 2, 3, 10]);
    expect(await comparePassword(first.temporaryPassword, hash)).toBe(true);
  });
  it("rejects missing or foreign-tenant accounts without writing", async () => {
    const repo = { findForStudent: vi.fn().mockResolvedValue(null), resetPassword: vi.fn() };
    await expect(new GuardianService(repo as any).resetPasswordForStudent(99, 10, 3)).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.resetPassword).not.toHaveBeenCalled();
  });

  const runAuth = async (version: string | undefined, hash: string, path = "/change-password", mustChangePassword = true) => {
    vi.spyOn(guardianRepository, "findByIdForTenant").mockResolvedValue({ passwordHash: hash, mustChangePassword } as any);
    const token = generateToken({ type: "guardian", guardianId: 7, madrasaId: 2, credentialVersion: version });
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    await guardianAuthMiddleware({ headers: { authorization: `Bearer ${token}` }, tenant: { madrasa_id: 2 }, path } as any, res as any, next);
    return { res, next };
  };
  it("revokes pre-reset and legacy sessions", async () => {
    for (const version of [guardianCredentialVersion("old-hash"), undefined]) {
      const { res, next } = await runAuth(version, "new-hash");
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    }
  });
  it("restricts temporary sessions to changing the password", async () => {
    const version = guardianCredentialVersion("new-hash");
    const blocked = await runAuth(version, "new-hash", "/me/children");
    expect(blocked.res.status).toHaveBeenCalledWith(403);
    expect(blocked.next).not.toHaveBeenCalled();
    const allowed = await runAuth(version, "new-hash");
    expect(allowed.next).toHaveBeenCalledOnce();
  });
  it("returns a replacement session after changing the temporary password", async () => {
    const repo = { findByIdForTenant: vi.fn().mockResolvedValue({ id: 7 }), updatePassword: vi.fn() };
    const token = await new GuardianService(repo as any).changePassword(7, 2, "my-new-password");
    const hash = repo.updatePassword.mock.calls[0][1];
    expect(await comparePassword("my-new-password", hash)).toBe(true);
    expect(verifyToken(token)).toMatchObject({ guardianId: 7, madrasaId: 2, credentialVersion: guardianCredentialVersion(hash) });
  });
});
