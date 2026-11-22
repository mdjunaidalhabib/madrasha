import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../shared/subscription/subscription-state", () => ({ getSubscriptionState: vi.fn(async () => "ACTIVE") }));
vi.mock("../../classPanal/class-panel.service", () => ({ classPanelService: { listDivisions: vi.fn() } }));
import { prisma } from "../../../shared/database/prisma";
import { guardianRepository } from "../guardian.repository";
import { GuardianService } from "../guardian.service";
import { guardianAuthMiddleware } from "../../../shared/middleware/guardianAuth.middleware";
import { generateToken } from "../../../shared/utils/jwt.util";
import { guardianCredentialVersion } from "../guardian-session";

const guardian = { id: 7, madrasaId: 2, phone: "01712345678", isActive: 1, passwordHash: "hash", mustChangePassword: false };
afterEach(() => vi.restoreAllMocks());

describe("guardian access requires a current student", () => {
  it("rejects login when no linked, undeleted student has this phone in this tenant", async () => {
    const lookup = vi.spyOn(prisma.guardian, "findFirst").mockResolvedValue(null);
    await expect(new GuardianService().login(guardian.phone, "correct", 2)).rejects.toMatchObject({ statusCode: 400 });
    expect(lookup).toHaveBeenCalledWith({ where: {
      madrasaId: 2, phone: guardian.phone, isActive: 1,
      students: { some: { student: { madrasaId: 2, deletedAt: null, guardianPhone: guardian.phone } } },
    } });
  });

  it.each(["/me/children", "/change-password", "/notices"])("blocks existing sessions on %s after the last student is removed", async (path) => {
    vi.spyOn(prisma.guardian, "findFirst").mockResolvedValue(guardian as any);
    const child = vi.spyOn(prisma.guardianStudent, "findFirst").mockResolvedValue(null);
    const token = generateToken({ type: "guardian", guardianId: 7, madrasaId: 2, credentialVersion: guardianCredentialVersion("hash") });
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    await guardianAuthMiddleware({ headers: { authorization: `Bearer ${token}` }, tenant: { madrasa_id: 2 }, path } as any, res as any, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(child).toHaveBeenCalledWith({ where: {
      guardianId: 7, student: { madrasaId: 2, deletedAt: null, guardianPhone: guardian.phone },
    }, select: { id: true } });
  });

  it("keeps access when at least one matching sibling remains", async () => {
    vi.spyOn(prisma.guardian, "findFirst").mockResolvedValue(guardian as any);
    vi.spyOn(prisma.guardianStudent, "findFirst").mockResolvedValue({ id: 1 } as any);
    expect(await guardianRepository.findByIdForTenant(7, 2)).toEqual(guardian);
  });

  it.each([
    { deletedAt: new Date(), madrasaId: 2, guardianPhone: guardian.phone },
    { deletedAt: null, madrasaId: 3, guardianPhone: guardian.phone },
    { deletedAt: null, madrasaId: 2, guardianPhone: "01812345678" },
  ])("rejects stale ownership for removed, foreign or changed-phone students", async (student) => {
    vi.spyOn(prisma.guardianStudent, "findUnique").mockResolvedValue({ guardian, student } as any);
    expect(await guardianRepository.findOwnership(7, 10)).toBeNull();
  });

  it("only lists children still registered to this phone", async () => {
    vi.spyOn(prisma.guardian, "findFirst").mockResolvedValue(guardian as any);
    vi.spyOn(prisma.guardianStudent, "findFirst").mockResolvedValue({ id: 1 } as any);
    const children = vi.spyOn(prisma.guardianStudent, "findMany").mockResolvedValue([]);
    await guardianRepository.findChildrenForGuardian(7, 2);
    expect(children).toHaveBeenCalledWith(expect.objectContaining({ where: {
      guardianId: 7, student: { madrasaId: 2, deletedAt: null, guardianPhone: guardian.phone },
    } }));
  });

  it("reuses an account with no current children when a new sibling is admitted", async () => {
    vi.spyOn(prisma.guardian, "findFirst").mockResolvedValue(guardian as any);
    const create = vi.spyOn(prisma.guardian, "create");
    const result = await guardianRepository.upsertGuardian({ madrasaId: 2, phone: guardian.phone, name: null, passwordHash: "new-hash" });
    expect(result).toEqual({ guardian, created: false });
    expect(create).not.toHaveBeenCalled();
  });
});
