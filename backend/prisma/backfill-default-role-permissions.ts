import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_ROLE_PERMISSION_KEYS } from "../src/shared/permissions/baseline-role-permissions";

/** One-off backfill — grants every already-provisioned madrasa's MUHTAMIM,
 * TALIMAT, and ACCOUNTANT roles real RolePermission rows, matching what new
 * madrasas now get at creation time (see superadmin.service.ts
 * createMadrasa). Before this, TALIMAT/ACCOUNTANT access came entirely from
 * hardcoded wildcard matching in rbac-policy.ts (removed), and MUHTAMIM had
 * no rows at all - both left the Roles & Permissions UI showing a
 * misleadingly empty/incomplete list for these built-in roles even though
 * they actually worked (or, for MUHTAMIM, always bypasses regardless).
 * Without this backfill, every pre-existing madrasa's TALIMAT/ACCOUNTANT
 * staff would lose real access the moment the wildcard logic is deleted.
 *
 * MUHTAMIM is handled separately from the TALIMAT/ACCOUNTANT fixed-key map:
 * it gets the ENTIRE current permission catalog (not a fixed list), since it
 * bypasses permission checks entirely and this is purely a UI-accuracy fix,
 * not a real access control (see isMuhtamimRole in rbac.middleware.ts).
 *
 * Idempotent: uses skipDuplicates, safe to re-run.
 *
 * Dry run (default):  npx ts-node prisma/backfill-default-role-permissions.ts
 * Apply for real:      npx ts-node prisma/backfill-default-role-permissions.ts --apply */

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");

async function main() {
  const roleKeys = [...Object.keys(DEFAULT_ROLE_PERMISSION_KEYS), "MUHTAMIM"];

  const roles = await prisma.role.findMany({
    where: { keyName: { in: roleKeys } },
    select: { id: true, keyName: true, madrasaId: true, madrasa: { select: { name: true } } },
  });

  const allPermissions = await prisma.permission.findMany({ select: { id: true, keyName: true } });

  let totalGrantsToCreate = 0;
  let rolesTouched = 0;

  for (const role of roles) {
    const keyName = role.keyName as string;
    const isMuhtamim = keyName === "MUHTAMIM";
    const defaultKeys = DEFAULT_ROLE_PERMISSION_KEYS[keyName];
    if (!isMuhtamim && !defaultKeys?.length) continue;

    const permissionRows = isMuhtamim
      ? allPermissions
      : await prisma.permission.findMany({
          where: { keyName: { in: defaultKeys } },
          select: { id: true, keyName: true },
        });

    const existing = await prisma.rolePermission.findMany({
      where: { roleId: role.id },
      select: { permissionId: true },
    });
    const existingIds = new Set(existing.map((e) => e.permissionId));

    const missing = permissionRows.filter((p) => !existingIds.has(p.id));
    if (!missing.length) continue;

    rolesTouched++;
    totalGrantsToCreate += missing.length;
    console.log(
      `   - ${role.madrasa?.name} / ${keyName}: +${missing.length} permission(s) (${missing
        .map((m) => m.keyName)
        .join(", ")})`,
    );

    if (APPLY) {
      await prisma.rolePermission.createMany({
        data: missing.map((p) => ({ roleId: role.id, permissionId: p.id })),
        skipDuplicates: true,
      });
    }
  }

  console.log(`\nRoles scanned: ${roles.length}`);
  console.log(`Roles needing grants: ${rolesTouched}`);
  console.log(`Permission grants to create: ${totalGrantsToCreate}`);

  if (!APPLY) {
    console.log("\nDry run only — no rows written. Re-run with --apply to actually insert these grants.");
    return;
  }

  console.log("\n✅ Backfill applied.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
