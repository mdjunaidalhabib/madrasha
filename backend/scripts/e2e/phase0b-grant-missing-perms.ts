import "dotenv/config";
import { prisma } from "../../src/shared/database/prisma";
import { DEFAULT_ROLE_PERMISSION_KEYS } from "../../src/shared/permissions/baseline-role-permissions";
import { readFixtureState } from "./lib";

// Scoped equivalent of prisma/backfill-default-role-permissions.ts, but
// restricted to ONLY the two dedicated E2E test madrasas (from phase0's
// fixture state, not hardcoded - see lib.ts's fixture-state comment for why)
// instead of every madrasa in the database - these two roles were created
// via createMadrasa() before `npx prisma db seed` re-synced the permission
// catalog with the exam-operations keys (exam.room.*/exam.seat.*/
// exam.invigilator.*/exam.attendance.*) added in this hardening pass, so
// their RolePermission grants are missing those. Idempotent (skipDuplicates).

async function main() {
  const state = readFixtureState() as { madrasaAId?: number; madrasaBId?: number };
  if (!state.madrasaAId || !state.madrasaBId) {
    throw new Error("Missing madrasaAId/madrasaBId in fixture state - run phase0-provision.ts first");
  }
  const testMadrasaIds = [state.madrasaAId, state.madrasaBId];

  const roles = await prisma.role.findMany({
    where: { madrasaId: { in: testMadrasaIds }, keyName: { in: Object.keys(DEFAULT_ROLE_PERMISSION_KEYS) } },
    select: { id: true, keyName: true, madrasaId: true },
  });

  for (const role of roles) {
    const keyName = role.keyName as string;
    const defaultKeys = DEFAULT_ROLE_PERMISSION_KEYS[keyName];
    if (!defaultKeys?.length) continue;

    const permissionRows = await prisma.permission.findMany({
      where: { keyName: { in: defaultKeys } },
      select: { id: true, keyName: true },
    });
    const existing = await prisma.rolePermission.findMany({
      where: { roleId: role.id },
      select: { permissionId: true },
    });
    const existingIds = new Set(existing.map((e) => e.permissionId));
    const missing = permissionRows.filter((p) => !existingIds.has(p.id));

    if (missing.length) {
      await prisma.rolePermission.createMany({
        data: missing.map((p) => ({ roleId: role.id, permissionId: p.id })),
        skipDuplicates: true,
      });
      console.log(`madrasa=${role.madrasaId} role=${keyName}: granted ${missing.length} -> ${missing.map((m) => m.keyName).join(", ")}`);
    } else {
      console.log(`madrasa=${role.madrasaId} role=${keyName}: already up to date`);
    }
  }
}

main()
  .catch((e) => {
    console.error("FAILED:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
