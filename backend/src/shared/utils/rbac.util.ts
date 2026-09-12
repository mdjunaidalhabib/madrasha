import { prisma } from "../database/prisma";
import { isMuhtamimRole, isSuperAdminRole, normalizeAppRole } from "../permissions";

/**
 * Muhtamim/Super Admin already bypass every granular RBAC permission check
 * (see rbac.middleware.ts) - a genuinely single-admin madrasa has no second
 * person to hand a maker/checker step to, so those two roles are the
 * built-in escape hatch from any separation-of-duties check (e.g. "can't
 * verify your own submission", "can't approve a result you verified"),
 * exactly like every other permission gate in this app.
 */
export async function isPrivilegedActor(userId: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: { select: { keyName: true, nameBn: true } } },
  });
  const role = normalizeAppRole(user?.role?.keyName || user?.role?.nameBn || "");
  return isSuperAdminRole(role) || isMuhtamimRole(role);
}
