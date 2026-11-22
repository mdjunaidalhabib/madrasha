import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../shared/utils/hash.util", () => ({ comparePassword: vi.fn(async () => false), hashPassword: vi.fn() }));
vi.mock("../../../shared/utils/jwt.util", () => ({ generateToken: vi.fn(() => "token") }));
vi.mock("../../../shared/subscription/subscription-state", () => ({ getSubscriptionState: vi.fn(async () => "ACTIVE") }));
vi.mock("../../classPanal/class-panel.service", () => ({ classPanelService: { listDivisions: vi.fn() } }));
import { GuardianService, guardianService } from "../guardian.service";
import { guardianLogin } from "../guardian.controller";
import { comparePassword } from "../../../shared/utils/hash.util";
import { BadRequestError } from "../../../shared/errors";

const now = new Date("2026-11-22T10:00:00Z");
function repository(overrides = {}) {
  return {
    findActiveByPhone: vi.fn(async () => ({ id: 1, madrasaId: 2, phone: "01712345678", failedLoginAttempts: 4, lockedUntil: null, passwordHash: "hash", ...overrides })),
    recordFailedLogin: vi.fn(), recordSuccessfulLogin: vi.fn(),
  };
}
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("guardian login lockout countdown", () => {
  it.each([[0, 4], [1, 3], [3, 1]])("reports remaining attempts after %i previous failures", async (previous, remaining) => {
    const repo = repository({ failedLoginAttempts: previous });
    await expect(new GuardianService(repo as any).login("01712345678", "wrong", 2)).rejects.toMatchObject({
      details: { code: "GUARDIAN_LOGIN_INVALID", remainingAttempts: remaining },
    });
    expect(repo.recordFailedLogin).toHaveBeenCalledWith(1, previous + 1, null);
  });
  it("starts a fresh allowance after the lock expires", async () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    const repo = repository({ failedLoginAttempts: 5, lockedUntil: now });
    await expect(new GuardianService(repo as any).login("01712345678", "wrong", 2)).rejects.toMatchObject({
      details: { code: "GUARDIAN_LOGIN_INVALID", remainingAttempts: 4 },
    });
    expect(repo.recordFailedLogin).toHaveBeenCalledWith(1, 1, null);
  });
  it("includes remaining attempts in the login response", async () => {
    vi.spyOn(guardianService, "login").mockRejectedValueOnce(new BadRequestError("Invalid credentials", {
      code: "GUARDIAN_LOGIN_INVALID", remainingAttempts: 4,
    }));
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await guardianLogin({ body: { phone: "01712345678", password: "wrong" }, tenant: { madrasa_id: 2 } } as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "GUARDIAN_LOGIN_INVALID", remainingAttempts: 4 }));
  });
  it("returns an exact deadline on the fifth failed attempt", async () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    const repo = repository();
    await expect(new GuardianService(repo as any).login("01712345678", "wrong", 2)).rejects.toMatchObject({
      details: { code: "GUARDIAN_LOGIN_LOCKED", lockedUntil: "2026-11-22T10:15:00.000Z" },
    });
    expect(repo.recordFailedLogin).toHaveBeenCalledWith(1, 5, new Date("2026-11-22T10:15:00Z"));
  });
  it("keeps rejecting a correct password until the deadline without extending it", async () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    const repo = repository({ lockedUntil: new Date("2026-11-22T10:02:05Z") });
    vi.mocked(comparePassword).mockClear();
    await expect(new GuardianService(repo as any).login("01712345678", "correct", 2)).rejects.toMatchObject({
      details: { lockedUntil: "2026-11-22T10:02:05.000Z" },
    });
    expect(comparePassword).not.toHaveBeenCalled();
    expect(repo.recordFailedLogin).not.toHaveBeenCalled();
  });
  it("allows password verification at the exact expiry", async () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    vi.mocked(comparePassword).mockResolvedValueOnce(true);
    const repo = repository({ lockedUntil: now });
    const result = await new GuardianService(repo as any).login("01712345678", "correct", 2);
    expect(result.token).toBe("token");
    expect(repo.recordSuccessfulLogin).toHaveBeenCalledWith(1);
  });
  it("sends remaining seconds and a Retry-After header from the login controller", async () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    vi.spyOn(guardianService, "login").mockRejectedValueOnce(new BadRequestError("Locked", {
      code: "GUARDIAN_LOGIN_LOCKED", lockedUntil: "2026-11-22T10:02:05.000Z",
    }));
    const res = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
    await guardianLogin({ body: { phone: "01712345678", password: "wrong" }, tenant: { madrasa_id: 2 } } as any, res as any);
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "125");
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ retryAfterSeconds: 125, code: "GUARDIAN_LOGIN_LOCKED" }));
  });
});
